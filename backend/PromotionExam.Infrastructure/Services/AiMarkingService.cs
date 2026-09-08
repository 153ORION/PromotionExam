using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PromotionExam.Application.Common.Ai;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.Marking;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.Infrastructure.Services
{
    public class AiMarkingService : IAiMarkingService
    {
        private const string RubricPromptVersion = "gemini-rubric-v1";
        private const string EvaluationPromptVersion = "gemini-evaluation-v1";
        private const string StandardAnswerPromptVersion = "gemini-answer-v1";

        private readonly ApplicationDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ICryptographyService _cryptographyService;

        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public AiMarkingService(
            ApplicationDbContext context,
            HttpClient httpClient,
            IConfiguration configuration,
            ICryptographyService cryptographyService)
        {
            _context = context;
            _httpClient = httpClient;
            _configuration = configuration;
            _cryptographyService = cryptographyService;
        }

        public async Task<AiRubricDto?> GetQuestionRubricAsync(int questionId)
        {
            var question = await _context.QuestionBanks
                .Include(q => q.QuestionSet)
                .FirstOrDefaultAsync(q => q.QuestionId == questionId && q.TypeId == 2);

            if (question == null)
                return null;

            var activeRubric = await _context.AiRubricMasters
                .Where(r => r.QuestionId == questionId && r.IsActive)
                .OrderByDescending(r => r.VersionNo)
                .FirstOrDefaultAsync();

            if (activeRubric == null)
            {
                return new AiRubricDto
                {
                    QuestionId = questionId,
                    MaxMarks = question.Marks,
                    Status = "NotGenerated",
                    NeedsRegeneration = false
                };
            }

            return MapRubric(activeRubric, question);
        }

        public async Task<string> GenerateStandardAnswerAsync(int questionId, long requestedBy)
        {
            var question = await _context.QuestionBanks
                .Include(q => q.QuestionSet)
                .FirstOrDefaultAsync(q => q.QuestionId == questionId && q.TypeId == 2);

            if (question == null)
                throw new InvalidOperationException("Narrative question not found.");

            var subjectContext = await BuildSubjectContextAsync(question);

            var systemPrompt =
                "You are an expert academic examiner and senior subject specialist for institutional promotion examinations. " +
                "Draft an authoritative, comprehensive, and well-structured model / standard answer for the question provided. " +
                "The answer must be factually correct, logically sequenced, and directly aligned with the full marks allocated. " +
                "Do NOT include any conversational preamble, meta-commentary, or markdown code fences. Provide only the direct reference answer text.";

            var userPayload = JsonSerializer.Serialize(new
            {
                questionId = question.QuestionId,
                question = question.Question,
                subjectContext,
                fullMarks = question.Marks,
                instruction = "Generate a model answer that demonstrates full mastery, appropriate for scoring the maximum marks."
            }, _jsonOptions);

            var generatedAnswer = await SendGeminiTextPromptAsync(systemPrompt, userPayload);
            if (string.IsNullOrWhiteSpace(generatedAnswer))
                throw new InvalidOperationException("Google Gemini generated an empty standard answer.");

            question.NarrativeAnswer = generatedAnswer.Trim();
            await _context.SaveChangesAsync();

            return question.NarrativeAnswer;
        }

        public async Task<AiRubricDto> GenerateQuestionRubricAsync(int questionId, bool forceRegenerate, long requestedBy)
        {
            var question = await _context.QuestionBanks
                .Include(q => q.QuestionSet)
                .FirstOrDefaultAsync(q => q.QuestionId == questionId && q.TypeId == 2);

            if (question == null)
                throw new InvalidOperationException("Narrative question not found.");

            if (string.IsNullOrWhiteSpace(question.NarrativeAnswer))
            {
                // Auto-generate standard answer with Gemini if missing
                var generatedAnswer = await GenerateStandardAnswerAsync(questionId, requestedBy);
                question.NarrativeAnswer = generatedAnswer;
            }

            var currentHash = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);
            var subjectContext = await BuildSubjectContextAsync(question);

            var activeRubric = await _context.AiRubricMasters
                .Where(r => r.QuestionId == questionId && r.IsActive)
                .OrderByDescending(r => r.VersionNo)
                .FirstOrDefaultAsync();

            if (activeRubric != null && activeRubric.RubricHash == currentHash && !forceRegenerate)
                return MapRubric(activeRubric, question);

            var generated = await GenerateRubricFromGeminiAsync(question, subjectContext);
            NormalizeRubric(generated, question.Marks);

            var nextVersion = (await _context.AiRubricMasters
                .Where(r => r.QuestionId == questionId)
                .MaxAsync(r => (int?)r.VersionNo) ?? 0) + 1;

            if (activeRubric != null)
            {
                activeRubric.IsActive = false;
                activeRubric.UpdateDate = DateTime.UtcNow;
            }

            var rubric = new AiRubricMaster
            {
                QuestionId = question.QuestionId,
                VersionNo = nextVersion,
                RubricHash = currentHash,
                QuestionSnapshot = question.Question,
                StandardAnswerSnapshot = question.NarrativeAnswer,
                SubjectSnapshot = subjectContext,
                MaxMarks = question.Marks,
                RubricSummary = generated.RubricSummary,
                SourceModel = GetModelName(),
                PromptVersion = RubricPromptVersion,
                IsActive = true,
                GeneratedBy = requestedBy > 0 ? requestedBy : (long?)null,
                EntryDate = DateTime.UtcNow,
                CriteriaJson = SerializeRubricCriteria(generated.Criteria)
            };

            _context.AiRubricMasters.Add(rubric);
            await _context.SaveChangesAsync();

            return MapRubric(rubric, question);
        }

        public async Task<AiNarrativeEvaluationDto> EvaluateAnswerAsync(int examineeId, int questionId, bool forceReevaluate, long requestedBy)
        {
            var question = await _context.QuestionBanks
                .Include(q => q.QuestionSet)
                .FirstOrDefaultAsync(q => q.QuestionId == questionId && q.TypeId == 2);

            if (question == null)
                throw new InvalidOperationException("Narrative question not found.");

            var rubric = await _context.AiRubricMasters
                .Where(r => r.QuestionId == questionId && r.IsActive)
                .OrderByDescending(r => r.VersionNo)
                .FirstOrDefaultAsync();

            var currentHash = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);

            // Auto-generate or regenerate rubric if missing or outdated
            if (rubric == null || !string.Equals(rubric.RubricHash, currentHash, StringComparison.OrdinalIgnoreCase))
            {
                var rubricDto = await GenerateQuestionRubricAsync(questionId, forceRegenerate: true, requestedBy);
                rubric = await _context.AiRubricMasters.FindAsync(rubricDto.RubricMasterId);
                if (rubric == null)
                    throw new InvalidOperationException("Failed to establish active rubric for question evaluation.");
            }

            var studentAnswer = (await _context.ExamAnswerSheets
                .Where(a => a.ExamineeId == examineeId && a.QuestionId == questionId)
                .OrderBy(a => a.EAS_Id)
                .Select(a => a.Answer)
                .LastOrDefaultAsync())?.Trim() ?? string.Empty;

            var existing = await _context.ExamNarrativeAiEvaluations
                .FirstOrDefaultAsync(e => e.ExamineeId == examineeId && e.QuestionId == questionId && e.RubricMasterId == rubric.RubricMasterId);

            if (existing != null && !forceReevaluate && string.Equals(existing.StudentAnswerSnapshot ?? string.Empty, studentAnswer, StringComparison.Ordinal))
                return MapEvaluation(existing, rubric, isCached: true);

            ValidatedEvaluation validated;
            if (string.IsNullOrWhiteSpace(studentAnswer) || studentAnswer.Equals("(No answer submitted)", StringComparison.OrdinalIgnoreCase))
            {
                validated = BuildEmptyAnswerEvaluation(examineeId, question, rubric);
            }
            else
            {
                var subjectContext = await BuildSubjectContextAsync(question);
                var rawEvaluation = await EvaluateWithGeminiAsync(question, rubric, studentAnswer, subjectContext);
                validated = ValidateAndNormalizeEvaluation(examineeId, question, rubric, studentAnswer, rawEvaluation);
            }

            if (existing == null)
            {
                existing = new ExamNarrativeAiEvaluation
                {
                    ExamineeId = examineeId,
                    QuestionId = questionId,
                    RubricMasterId = rubric.RubricMasterId,
                    EntryDate = DateTime.UtcNow
                };
                _context.ExamNarrativeAiEvaluations.Add(existing);
            }

            existing.StudentAnswerSnapshot = studentAnswer;
            existing.AwardedMarks = validated.AwardedMarks;
            existing.Confidence = validated.Confidence;
            existing.Summary = validated.Summary;
            existing.StrengthsJson = SerializeList(validated.Strengths);
            existing.MissingPointsJson = SerializeList(validated.MissingPoints);
            existing.IncorrectPointsJson = SerializeList(validated.IncorrectPoints);
            existing.CriterionBreakdownJson = JsonSerializer.Serialize(validated.CriterionBreakdown, _jsonOptions);
            existing.ValidationStatus = validated.ValidationStatus;
            existing.ValidationNotes = validated.ValidationNotes;
            existing.ReviewRecommended = validated.ReviewRecommended;
            existing.SourceModel = GetModelName();
            existing.PromptVersion = EvaluationPromptVersion;
            existing.RequestedBy = requestedBy > 0 ? requestedBy : (long?)null;
            existing.UpdateDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return MapEvaluation(existing, rubric, isCached: false);
        }

        public async Task<AutoMarkExamineeResultDto> AutoMarkExamineeAsync(int examineeId, bool forceReevaluate, bool autoApplyScores, long examinerId)
        {
            var reg = await _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                throw new InvalidOperationException("Examinee registration not found.");

            // Check if marking has already been finalized by a Final Approver
            var approverFlow = await _context.SysFlowpaths
                .FirstOrDefaultAsync(f => f.BatchId == reg.BatchId && f.ExamSetId == reg.QuestionSetId && f.Approver == true);

            var candidateQuestions = await GetCandidateNarrativeQuestionsListAsync(reg);

            if (!candidateQuestions.Any())
            {
                return new AutoMarkExamineeResultDto
                {
                    ExamineeId = examineeId,
                    ExamineeName = reg.User?.Name ?? $"Examinee #{examineeId}",
                    LoginId = reg.User?.LoginId ?? string.Empty,
                    TotalQuestions = 0,
                    EvaluatedCount = 0,
                    SkippedCount = 0,
                    TotalAwardedMarks = 0,
                    TotalMaxMarks = 0,
                    ScoresApplied = false,
                    Message = "No narrative questions found for this examinee."
                };
            }

            var results = new List<QuestionAutoMarkItemDto>();
            decimal totalAwardedMarks = 0;
            decimal totalMaxMarks = candidateQuestions.Sum(q => q.Marks);
            int evaluatedCount = 0;
            int skippedCount = 0;

            var existingScores = await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == examineeId && s.ExaminerId == examinerId)
                .ToListAsync();

            foreach (var q in candidateQuestions)
            {
                try
                {
                    var evaluation = await EvaluateAnswerAsync(examineeId, q.QuestionId, forceReevaluate, examinerId);
                    evaluatedCount++;
                    totalAwardedMarks += evaluation.AwardedMarks;

                    results.Add(new QuestionAutoMarkItemDto
                    {
                        QuestionId = q.QuestionId,
                        Question = q.Question,
                        MaxMarks = q.Marks,
                        AwardedMarks = evaluation.AwardedMarks,
                        Status = evaluation.IsCached ? "CachedEvaluation" : "Evaluated",
                        Remarks = evaluation.Summary,
                        Evaluation = evaluation
                    });

                    if (autoApplyScores)
                    {
                        var summaryParts = new List<string>();
                        if (!string.IsNullOrWhiteSpace(evaluation.Summary))
                            summaryParts.Add(evaluation.Summary);
                        if (evaluation.MissingPoints.Any())
                            summaryParts.Add("Missing: " + string.Join("; ", evaluation.MissingPoints));
                        if (evaluation.IncorrectPoints.Any())
                            summaryParts.Add("Incorrect: " + string.Join("; ", evaluation.IncorrectPoints));

                        var remarksText = summaryParts.Any() ? string.Join(" | ", summaryParts) : "Auto-marked by Gemini AI.";

                        var scoreRecord = existingScores.FirstOrDefault(s => s.QuestionId == q.QuestionId);
                        if (scoreRecord != null)
                        {
                            scoreRecord.Marks = evaluation.AwardedMarks;
                            scoreRecord.Remarks = remarksText;
                            scoreRecord.UpdateDate = DateTime.UtcNow;
                        }
                        else
                        {
                            var newScore = new ExamNarrativeScore
                            {
                                ExamineeId = examineeId,
                                QuestionId = q.QuestionId,
                                ExaminerId = examinerId,
                                Marks = evaluation.AwardedMarks,
                                Remarks = remarksText,
                                EntryDate = DateTime.UtcNow
                            };
                            _context.ExamNarrativeScores.Add(newScore);
                            existingScores.Add(newScore);
                        }
                    }
                }
                catch (Exception ex)
                {
                    skippedCount++;
                    results.Add(new QuestionAutoMarkItemDto
                    {
                        QuestionId = q.QuestionId,
                        Question = q.Question,
                        MaxMarks = q.Marks,
                        AwardedMarks = 0,
                        Status = "Error",
                        Remarks = ex.Message
                    });
                }
            }

            decimal? recalculatedWritten = null;

            if (autoApplyScores && evaluatedCount > 0)
            {
                await _context.SaveChangesAsync();
                recalculatedWritten = await RecalculateExamineeWrittenScoreAsync(examineeId, examinerId);
            }

            return new AutoMarkExamineeResultDto
            {
                ExamineeId = examineeId,
                ExamineeName = reg.User?.Name ?? $"Examinee #{examineeId}",
                LoginId = reg.User?.LoginId ?? string.Empty,
                TotalQuestions = candidateQuestions.Count,
                EvaluatedCount = evaluatedCount,
                SkippedCount = skippedCount,
                TotalAwardedMarks = Math.Round(totalAwardedMarks, 2),
                TotalMaxMarks = Math.Round(totalMaxMarks, 2),
                ScoresApplied = autoApplyScores && evaluatedCount > 0,
                TotalWrittenScore = recalculatedWritten,
                Questions = results,
                Message = autoApplyScores
                    ? $"Auto-marked {evaluatedCount} questions using Google Gemini. Awarded {totalAwardedMarks:F2} / {totalMaxMarks:F2} marks and updated candidate scorecard."
                    : $"Evaluated {evaluatedCount} questions using Google Gemini without applying scores directly."
            };
        }

        private async Task<List<QuestionBank>> GetCandidateNarrativeQuestionsListAsync(ExamRegistration reg)
        {
            var assignedQuestionIds = await _context.ExamQuestionSheets
                .Where(s => s.ExamineeId == reg.ExamineeId && s.IsActive == true)
                .OrderBy(s => s.QuestionSeq)
                .Select(s => s.QuestionId)
                .ToListAsync();

            if (assignedQuestionIds.Any())
            {
                var questions = await _context.QuestionBanks
                    .Where(q => assignedQuestionIds.Contains(q.QuestionId) && q.TypeId == 2 && q.IsActive == true)
                    .ToListAsync();

                return assignedQuestionIds
                    .Select(id => questions.FirstOrDefault(q => q.QuestionId == id))
                    .Where(q => q != null)
                    .Cast<QuestionBank>()
                    .ToList();
            }

            return await _context.QuestionBanks
                .Where(q => q.SetId == reg.QuestionSetId && q.TypeId == 2 && q.IsActive == true)
                .OrderBy(q => q.QuestionId)
                .ToListAsync();
        }

        private async Task<decimal> RecalculateExamineeWrittenScoreAsync(int examineeId, long examinerId)
        {
            var reg = await _context.ExamRegistrations.FindAsync(examineeId);
            if (reg == null) return 0;

            var allScores = await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == examineeId)
                .ToListAsync();

            if (!allScores.Any())
            {
                reg.WrittenScore = 0;
                reg.TotalScore = reg.MCQScore ?? 0;
                await _context.SaveChangesAsync();
                return 0;
            }

            var approverFlow = await _context.SysFlowpaths
                .FirstOrDefaultAsync(f => f.BatchId == reg.BatchId && f.ExamSetId == reg.QuestionSetId && f.Approver == true);

            decimal totalWritten;

            if (approverFlow != null)
            {
                var approverScores = allScores
                    .Where(s => s.ExaminerId == approverFlow.ExaminerId)
                    .ToList();

                var narrativeQuestions = await GetCandidateNarrativeQuestionsListAsync(reg);

                if (narrativeQuestions.Any() && approverScores.Count >= narrativeQuestions.Count)
                {
                    totalWritten = approverScores.Sum(s => s.Marks);
                }
                else if (approverScores.Any())
                {
                    totalWritten = narrativeQuestions.Sum(q => {
                        var appScore = approverScores.FirstOrDefault(s => s.QuestionId == q.QuestionId);
                        if (appScore != null) return appScore.Marks;
                        var otherScores = allScores.Where(s => s.QuestionId == q.QuestionId).ToList();
                        return otherScores.Any() ? otherScores.Average(s => s.Marks) : 0;
                    });
                }
                else
                {
                    totalWritten = allScores
                        .GroupBy(s => s.QuestionId)
                        .Sum(g => g.Average(s => s.Marks));
                }
            }
            else
            {
                totalWritten = allScores
                    .GroupBy(s => s.QuestionId)
                    .Sum(g => g.Average(s => s.Marks));
            }

            totalWritten = Math.Round(totalWritten, 2);

            reg.WrittenScore = totalWritten;
            reg.TotalScore = (reg.MCQScore ?? 0) + totalWritten;
            reg.LastUpdateBy = (int)examinerId;
            reg.LastUpdateTime = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return totalWritten;
        }

        private async Task<string?> BuildSubjectContextAsync(QuestionBank question)
        {
            if (question.QuestionSet == null)
                return null;

            var ids = new[] { question.QuestionSet.DepartmentId, question.QuestionSet.ConcentrationId, question.QuestionSet.LocationId }
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            var lookupMap = ids.Any()
                ? await _context.SysLookups
                    .Where(l => ids.Contains(l.LookupId))
                    .ToDictionaryAsync(l => l.LookupId, l => l.LookupText)
                : new Dictionary<int, string>();

            var parts = new List<string>();

            if (!string.IsNullOrWhiteSpace(question.QuestionSet.SetName))
                parts.Add(question.QuestionSet.SetName.Trim());
            if (question.QuestionSet.DepartmentId.HasValue && lookupMap.ContainsKey(question.QuestionSet.DepartmentId.Value))
                parts.Add(lookupMap[question.QuestionSet.DepartmentId.Value]);
            if (question.QuestionSet.ConcentrationId.HasValue && lookupMap.ContainsKey(question.QuestionSet.ConcentrationId.Value))
                parts.Add(lookupMap[question.QuestionSet.ConcentrationId.Value]);
            if (question.QuestionSet.LocationId.HasValue && lookupMap.ContainsKey(question.QuestionSet.LocationId.Value))
                parts.Add(lookupMap[question.QuestionSet.LocationId.Value]);

            return parts.Any() ? string.Join(" | ", parts.Distinct()) : null;
        }

        private async Task<GeneratedRubricResponse> GenerateRubricFromGeminiAsync(QuestionBank question, string? subjectContext)
        {
            var systemPrompt =
                "You are an expert promotion-exam rubric designer. Create a reusable, standardized rubric from the teacher's standard answer. " +
                "Focus on key concepts, completeness, subject logic, and partial-credit boundaries. " +
                "The rubric must be question-specific, concise, and safe for repeated reuse across many employee answers.\n\n" +
                "You MUST return valid JSON matching this exact structure:\n" +
                "{\n" +
                "  \"rubricSummary\": \"string\",\n" +
                "  \"criteria\": [\n" +
                "    {\n" +
                "      \"criterionTitle\": \"string\",\n" +
                "      \"expectedConcept\": \"string\",\n" +
                "      \"scoringGuidance\": \"string\",\n" +
                "      \"maxMarks\": number,\n" +
                "      \"keywords\": [\"string\"],\n" +
                "      \"commonMistakes\": [\"string\"]\n" +
                "    }\n" +
                "  ]\n" +
                "}";

            var userPayload = JsonSerializer.Serialize(new
            {
                questionId = question.QuestionId,
                question = question.Question,
                subjectContext,
                fullMarks = question.Marks,
                standardAnswer = question.NarrativeAnswer,
                instruction = "Break the total marks into a reusable question-specific rubric. Accept semantic equivalents, not just exact wording. The sum of maxMarks must equal fullMarks."
            }, _jsonOptions);

            return await SendGeminiStructuredPromptAsync<GeneratedRubricResponse>(systemPrompt, userPayload);
        }

        private async Task<RawEvaluationResponse> EvaluateWithGeminiAsync(QuestionBank question, AiRubricMaster rubric, string studentAnswer, string? subjectContext)
        {
            var systemPrompt =
                "You are an experienced examiner for professional promotion exams. Evaluate the employee's narrative answer strictly against the saved rubric criteria. " +
                "Reward correct meaning, partial understanding, and subject-appropriate logic. Do not penalize for slight variations in wording if the underlying concept is correct.\n\n" +
                "You MUST return valid JSON matching this exact structure:\n" +
                "{\n" +
                "  \"awardedMarks\": number,\n" +
                "  \"summary\": \"string\",\n" +
                "  \"strengths\": [\"string\"],\n" +
                "  \"missingPoints\": [\"string\"],\n" +
                "  \"incorrectPoints\": [\"string\"],\n" +
                "  \"confidence\": number,\n" +
                "  \"reviewRecommended\": boolean,\n" +
                "  \"criterionBreakdown\": [\n" +
                "    {\n" +
                "      \"rubricDetailId\": integer,\n" +
                "      \"criterionTitle\": \"string\",\n" +
                "      \"awardedMarks\": number,\n" +
                "      \"maxMarks\": number,\n" +
                "      \"reason\": \"string\"\n" +
                "    }\n" +
                "  ]\n" +
                "}";

            var userPayload = JsonSerializer.Serialize(new
            {
                questionId = question.QuestionId,
                question = question.Question,
                subjectContext,
                fullMarks = question.Marks,
                studentAnswer,
                rubricCriteria = DeserializeRubricCriteria(rubric.CriteriaJson),
                rubric = new
                {
                    rubric.RubricMasterId,
                    rubric.VersionNo,
                    rubric.RubricSummary
                },
                instruction = "Mark like an experienced examiner. Award marks for each criterion in the criterionBreakdown. Award partial marks fairly."
            }, _jsonOptions);

            return await SendGeminiStructuredPromptAsync<RawEvaluationResponse>(systemPrompt, userPayload);
        }

        public async Task<(bool Success, string Message)> TestGeminiConnectionAsync(string? explicitApiKey = null)
        {
            var apiKey = !string.IsNullOrWhiteSpace(explicitApiKey) ? explicitApiKey.Trim() : await GetGeminiApiKeyAsync();
            if (string.IsNullOrWhiteSpace(apiKey))
                return (false, "No Google Gemini API key provided or configured.");

            var model = GetModelName();
            var baseUrl = _configuration["Gemini:BaseEndpoint"] ?? "https://generativelanguage.googleapis.com/v1beta";
            var url = $"{baseUrl.TrimEnd('/')}/models/{model}:generateContent";

            var requestBody = new
            {
                contents = new object[]
                {
                    new
                    {
                        role = "user",
                        parts = new object[]
                        {
                            new { text = "Respond with JSON: {\"status\": \"ok\"}" }
                        }
                    }
                },
                generationConfig = new
                {
                    responseMimeType = "application/json",
                    maxOutputTokens = 30
                }
            };

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("x-goog-api-key", apiKey);
                request.Content = new StringContent(JsonSerializer.Serialize(requestBody, _jsonOptions), Encoding.UTF8, "application/json");

                using var response = await _httpClient.SendAsync(request);
                var raw = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    var errorMsg = ExtractGeminiErrorMessage(raw);
                    return (false, $"Gemini API Error (HTTP {(int)response.StatusCode}): {errorMsg}");
                }

                return (true, $"Gemini connection successful! Model '{model}' responded successfully.");
            }
            catch (Exception ex)
            {
                return (false, $"Connection error: {ex.Message}");
            }
        }

        private async Task<T> SendGeminiStructuredPromptAsync<T>(string systemPrompt, string userPayload)
        {
            var apiKey = await GetGeminiApiKeyAsync();
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Google Gemini API key is not configured on the server. Please provide a key in System Configuration or appsettings.json.");

            var model = GetModelName();
            var baseUrl = _configuration["Gemini:BaseEndpoint"] ?? "https://generativelanguage.googleapis.com/v1beta";
            var url = $"{baseUrl.TrimEnd('/')}/models/{model}:generateContent";

            var requestBody = new
            {
                systemInstruction = new
                {
                    parts = new object[]
                    {
                        new { text = systemPrompt }
                    }
                },
                contents = new object[]
                {
                    new
                    {
                        role = "user",
                        parts = new object[]
                        {
                            new { text = userPayload }
                        }
                    }
                },
                generationConfig = new
                {
                    responseMimeType = "application/json",
                    temperature = 0.1
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("x-goog-api-key", apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody, _jsonOptions), Encoding.UTF8, "application/json");

            using var response = await _httpClient.SendAsync(request);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var errorDetail = ExtractGeminiErrorMessage(raw);
                throw new InvalidOperationException($"Google Gemini API request failed ({(int)response.StatusCode}): {errorDetail}");
            }

            var jsonText = ExtractGeminiOutputText(raw);
            if (string.IsNullOrWhiteSpace(jsonText))
                throw new InvalidOperationException("Google Gemini returned an empty structured response.");

            try
            {
                var result = JsonSerializer.Deserialize<T>(jsonText, _jsonOptions);
                if (result == null)
                    throw new InvalidOperationException("Failed to deserialize Google Gemini structured response.");
                return result;
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"Failed to parse Google Gemini JSON output: {ex.Message}. Output was: {jsonText}");
            }
        }

        private async Task<string> SendGeminiTextPromptAsync(string systemPrompt, string userPayload)
        {
            var apiKey = await GetGeminiApiKeyAsync();
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Google Gemini API key is not configured on the server. Please provide a key in System Configuration or appsettings.json.");

            var model = GetModelName();
            var baseUrl = _configuration["Gemini:BaseEndpoint"] ?? "https://generativelanguage.googleapis.com/v1beta";
            var url = $"{baseUrl.TrimEnd('/')}/models/{model}:generateContent";

            var requestBody = new
            {
                systemInstruction = new
                {
                    parts = new object[]
                    {
                        new { text = systemPrompt }
                    }
                },
                contents = new object[]
                {
                    new
                    {
                        role = "user",
                        parts = new object[]
                        {
                            new { text = userPayload }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.2
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("x-goog-api-key", apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody, _jsonOptions), Encoding.UTF8, "application/json");

            using var response = await _httpClient.SendAsync(request);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var errorDetail = ExtractGeminiErrorMessage(raw);
                throw new InvalidOperationException($"Google Gemini API request failed ({(int)response.StatusCode}): {errorDetail}");
            }

            var outputText = ExtractGeminiOutputText(raw);
            return outputText.Trim();
        }

        private static string ExtractGeminiOutputText(string rawResponse)
        {
            try
            {
                using var document = JsonDocument.Parse(rawResponse);
                var root = document.RootElement;

                if (root.TryGetProperty("candidates", out var candidates) && candidates.ValueKind == JsonValueKind.Array)
                {
                    foreach (var candidate in candidates.EnumerateArray())
                    {
                        if (candidate.TryGetProperty("content", out var content) && content.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var part in parts.EnumerateArray())
                            {
                                if (part.TryGetProperty("text", out var textNode) && textNode.ValueKind == JsonValueKind.String)
                                {
                                    var text = textNode.GetString() ?? string.Empty;
                                    return CleanJsonCodeFences(text);
                                }
                            }
                        }
                    }
                }
            }
            catch
            {
                // fallback
            }

            return CleanJsonCodeFences(rawResponse);
        }

        private static string CleanJsonCodeFences(string text)
        {
            var trimmed = text.Trim();

            // Strip ```json ... ``` or ``` ... ```
            if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            {
                trimmed = trimmed.Substring(7);
            }
            else if (trimmed.StartsWith("```", StringComparison.Ordinal))
            {
                trimmed = trimmed.Substring(3);
            }

            if (trimmed.EndsWith("```", StringComparison.Ordinal))
            {
                trimmed = trimmed.Substring(0, trimmed.Length - 3);
            }

            trimmed = trimmed.Trim();

            // Find JSON object or array bounds
            var firstBrace = trimmed.IndexOf('{');
            var firstBracket = trimmed.IndexOf('[');

            if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket))
            {
                var lastBrace = trimmed.LastIndexOf('}');
                if (lastBrace > firstBrace)
                {
                    return trimmed.Substring(firstBrace, lastBrace - firstBrace + 1);
                }
            }
            else if (firstBracket >= 0)
            {
                var lastBracket = trimmed.LastIndexOf(']');
                if (lastBracket > firstBracket)
                {
                    return trimmed.Substring(firstBracket, lastBracket - firstBracket + 1);
                }
            }

            return trimmed;
        }

        private static string ExtractGeminiErrorMessage(string rawResponse)
        {
            try
            {
                using var doc = JsonDocument.Parse(rawResponse);
                if (doc.RootElement.TryGetProperty("error", out var errorObj))
                {
                    if (errorObj.TryGetProperty("message", out var msg))
                        return msg.GetString() ?? rawResponse;
                }
            }
            catch
            {
            }
            return rawResponse;
        }

        private static void NormalizeRubric(GeneratedRubricResponse rubric, decimal maxMarks)
        {
            if (rubric.Criteria == null || rubric.Criteria.Count == 0)
                throw new InvalidOperationException("Google Gemini rubric generation returned no criteria.");

            rubric.Criteria = rubric.Criteria
                .Where(c => !string.IsNullOrWhiteSpace(c.CriterionTitle) && !string.IsNullOrWhiteSpace(c.ExpectedConcept))
                .ToList();

            if (!rubric.Criteria.Any())
                throw new InvalidOperationException("Google Gemini rubric generation returned only invalid criteria.");

            foreach (var criterion in rubric.Criteria)
            {
                if (criterion.MaxMarks <= 0)
                    criterion.MaxMarks = 1.0m;
            }

            var total = rubric.Criteria.Sum(c => c.MaxMarks);
            var diff = Math.Round(maxMarks - total, 2);

            if (diff != 0)
            {
                var tolerance = Math.Max(0.50m, Math.Round(maxMarks * 0.15m, 2));
                if (Math.Abs(diff) > tolerance)
                {
                    // Proportionally scale criteria to match total marks
                    var scaleFactor = maxMarks / total;
                    decimal runningSum = 0;
                    for (int i = 0; i < rubric.Criteria.Count - 1; i++)
                    {
                        rubric.Criteria[i].MaxMarks = Math.Round(rubric.Criteria[i].MaxMarks * scaleFactor, 2);
                        runningSum += rubric.Criteria[i].MaxMarks;
                    }
                    rubric.Criteria[^1].MaxMarks = Math.Max(0.5m, Math.Round(maxMarks - runningSum, 2));
                }
                else
                {
                    rubric.Criteria[^1].MaxMarks = Math.Round(rubric.Criteria[^1].MaxMarks + diff, 2);
                    if (rubric.Criteria[^1].MaxMarks <= 0)
                        rubric.Criteria[^1].MaxMarks = 0.5m;
                }
            }
        }

        private ValidatedEvaluation BuildEmptyAnswerEvaluation(int examineeId, QuestionBank question, AiRubricMaster rubric)
        {
            return new ValidatedEvaluation
            {
                ExamineeId = examineeId,
                QuestionId = question.QuestionId,
                RubricMasterId = rubric.RubricMasterId,
                RubricVersionNo = rubric.VersionNo,
                AwardedMarks = 0,
                MaxMarks = question.Marks,
                Confidence = 1.0m,
                Summary = "No answer was submitted, so 0 marks were awarded.",
                Strengths = new List<string>(),
                MissingPoints = DeserializeRubricCriteria(rubric.CriteriaJson).OrderBy(d => d.SortOrder).Select(d => d.CriterionTitle).ToList(),
                IncorrectPoints = new List<string>(),
                CriterionBreakdown = DeserializeRubricCriteria(rubric.CriteriaJson)
                    .OrderBy(d => d.SortOrder)
                    .Select(d => new AiEvaluationCriterionDto
                    {
                        RubricDetailId = d.RubricDetailId,
                        CriterionTitle = d.CriterionTitle,
                        AwardedMarks = 0,
                        MaxMarks = d.MaxMarks,
                        Reason = "No answer was provided."
                    })
                    .ToList(),
                ValidationStatus = "Validated",
                ValidationNotes = "Evaluated locally because examinee submitted an empty response.",
                ReviewRecommended = false
            };
        }

        private ValidatedEvaluation ValidateAndNormalizeEvaluation(
            int examineeId,
            QuestionBank question,
            AiRubricMaster rubric,
            string studentAnswer,
            RawEvaluationResponse response)
        {
            var notes = new List<string>();
            var rubricCriteria = DeserializeRubricCriteria(rubric.CriteriaJson);
            var breakdownMap = (response.CriterionBreakdown ?? new List<RawEvaluationCriterion>())
                .GroupBy(x => x.RubricDetailId)
                .ToDictionary(g => g.Key, g => g.First());

            var normalizedBreakdown = new List<AiEvaluationCriterionDto>();

            foreach (var detail in rubricCriteria.OrderBy(d => d.SortOrder))
            {
                var hasItem = breakdownMap.TryGetValue(detail.RubricDetailId, out var rawItem);
                if (!hasItem)
                {
                    notes.Add($"Missing criterion breakdown for #{detail.RubricDetailId}.");
                    normalizedBreakdown.Add(new AiEvaluationCriterionDto
                    {
                        RubricDetailId = detail.RubricDetailId,
                        CriterionTitle = detail.CriterionTitle,
                        AwardedMarks = 0,
                        MaxMarks = detail.MaxMarks,
                        Reason = "Criterion not addressed or explanation omitted."
                    });
                    continue;
                }

                var boundedMarks = Math.Round(rawItem!.AwardedMarks, 2);
                if (boundedMarks < 0)
                {
                    boundedMarks = 0;
                    notes.Add($"Negative marks clamped for #{detail.RubricDetailId}.");
                }
                if (boundedMarks > detail.MaxMarks)
                {
                    boundedMarks = detail.MaxMarks;
                    notes.Add($"Over-limit marks clamped for #{detail.RubricDetailId}.");
                }

                normalizedBreakdown.Add(new AiEvaluationCriterionDto
                {
                    RubricDetailId = detail.RubricDetailId,
                    CriterionTitle = string.IsNullOrWhiteSpace(rawItem.CriterionTitle) ? detail.CriterionTitle : rawItem.CriterionTitle.Trim(),
                    AwardedMarks = boundedMarks,
                    MaxMarks = detail.MaxMarks,
                    Reason = string.IsNullOrWhiteSpace(rawItem.Reason)
                        ? "Evaluated against rubric standard."
                        : rawItem.Reason.Trim()
                });
            }

            var totalAwarded = Math.Round(normalizedBreakdown.Sum(x => x.AwardedMarks), 2);
            if (totalAwarded > question.Marks)
            {
                notes.Add("Criterion total exceeded question marks and was capped.");
                var overflow = totalAwarded - question.Marks;
                var last = normalizedBreakdown.Last();
                last.AwardedMarks = Math.Max(0, Math.Round(last.AwardedMarks - overflow, 2));
                totalAwarded = Math.Round(normalizedBreakdown.Sum(x => x.AwardedMarks), 2);
            }

            var confidence = response.Confidence;
            if (confidence < 0) confidence = 0;
            if (confidence > 1) confidence = 1;

            var summary = string.IsNullOrWhiteSpace(response.Summary)
                ? "Evaluated by Google Gemini against saved rubric criteria."
                : response.Summary.Trim();

            return new ValidatedEvaluation
            {
                ExamineeId = examineeId,
                QuestionId = question.QuestionId,
                RubricMasterId = rubric.RubricMasterId,
                RubricVersionNo = rubric.VersionNo,
                AwardedMarks = totalAwarded,
                MaxMarks = question.Marks,
                Confidence = Math.Round(confidence, 4),
                Summary = summary,
                Strengths = CleanList(response.Strengths),
                MissingPoints = CleanList(response.MissingPoints),
                IncorrectPoints = CleanList(response.IncorrectPoints),
                CriterionBreakdown = normalizedBreakdown,
                ValidationStatus = notes.Any() ? "Flagged" : "Validated",
                ValidationNotes = notes.Any() ? string.Join(" ", notes) : "Validated against saved Gemini rubric.",
                ReviewRecommended = response.ReviewRecommended || notes.Any() || confidence < 0.65m
            };
        }

        private AiRubricDto MapRubric(AiRubricMaster rubric, QuestionBank question)
        {
            var currentHash = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);
            var needsRegeneration = !string.Equals(rubric.RubricHash, currentHash, StringComparison.OrdinalIgnoreCase);

            return new AiRubricDto
            {
                RubricMasterId = rubric.RubricMasterId,
                QuestionId = rubric.QuestionId,
                VersionNo = rubric.VersionNo,
                Status = needsRegeneration ? "Outdated" : "Ready",
                IsActive = rubric.IsActive,
                NeedsRegeneration = needsRegeneration,
                SubjectSnapshot = rubric.SubjectSnapshot,
                MaxMarks = rubric.MaxMarks,
                RubricSummary = rubric.RubricSummary,
                SourceModel = rubric.SourceModel,
                PromptVersion = rubric.PromptVersion,
                EntryDate = rubric.EntryDate,
                CriteriaCount = DeserializeRubricCriteria(rubric.CriteriaJson).Count,
                Criteria = DeserializeRubricCriteria(rubric.CriteriaJson)
            };
        }

        private AiNarrativeEvaluationDto MapEvaluation(ExamNarrativeAiEvaluation evaluation, AiRubricMaster rubric, bool isCached)
        {
            return new AiNarrativeEvaluationDto
            {
                AiEvaluationId = evaluation.AiEvaluationId,
                ExamineeId = evaluation.ExamineeId,
                QuestionId = evaluation.QuestionId,
                RubricMasterId = evaluation.RubricMasterId,
                RubricVersionNo = rubric.VersionNo,
                AwardedMarks = evaluation.AwardedMarks,
                MaxMarks = rubric.MaxMarks,
                Confidence = Math.Round(evaluation.Confidence ?? 0, 4),
                Summary = evaluation.Summary,
                Strengths = DeserializeList(evaluation.StrengthsJson),
                MissingPoints = DeserializeList(evaluation.MissingPointsJson),
                IncorrectPoints = DeserializeList(evaluation.IncorrectPointsJson),
                CriterionBreakdown = DeserializeBreakdown(evaluation.CriterionBreakdownJson),
                ValidationStatus = evaluation.ValidationStatus,
                ValidationNotes = evaluation.ValidationNotes,
                ReviewRecommended = evaluation.ReviewRecommended,
                SourceModel = evaluation.SourceModel,
                PromptVersion = evaluation.PromptVersion,
                EntryDate = evaluation.UpdateDate ?? evaluation.EntryDate,
                IsCached = isCached
            };
        }

        private string GetModelName()
        {
            return _configuration["Gemini:Model"] ?? "gemini-2.5-flash";
        }

        private async Task<string?> GetGeminiApiKeyAsync()
        {
            var dbKey = await _context.SysCompanyConfigs
                .OrderBy(c => c.ConfigId)
                .Select(c => c.GeminiApiKey ?? c.OpenAiApiKey)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(dbKey))
            {
                var decrypted = _cryptographyService.DecryptLegacy(dbKey);
                if (!string.IsNullOrWhiteSpace(decrypted))
                    return decrypted;
            }

            return _configuration["Gemini:ApiKey"] ?? _configuration["OpenAI:ApiKey"];
        }

        private string SerializeList(List<string>? values)
        {
            return JsonSerializer.Serialize(CleanList(values), _jsonOptions);
        }

        private string SerializeRubricCriteria(List<GeneratedRubricCriterion> criteria)
        {
            var stored = criteria.Select((c, index) => new AiRubricCriterionDto
            {
                RubricDetailId = index + 1,
                CriterionTitle = c.CriterionTitle.Trim(),
                ExpectedConcept = c.ExpectedConcept.Trim(),
                ScoringGuidance = string.IsNullOrWhiteSpace(c.ScoringGuidance) ? null : c.ScoringGuidance.Trim(),
                MaxMarks = Math.Round(c.MaxMarks, 2),
                SortOrder = index + 1,
                Keywords = CleanList(c.Keywords),
                CommonMistakes = CleanList(c.CommonMistakes)
            }).ToList();

            return JsonSerializer.Serialize(stored, _jsonOptions);
        }

        private List<AiRubricCriterionDto> DeserializeRubricCriteria(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<AiRubricCriterionDto>();

            try
            {
                return JsonSerializer.Deserialize<List<AiRubricCriterionDto>>(json, _jsonOptions) ?? new List<AiRubricCriterionDto>();
            }
            catch
            {
                return new List<AiRubricCriterionDto>();
            }
        }

        private static List<string> DeserializeList(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<string>();

            try
            {
                return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private static List<string> CleanList(List<string>? values)
        {
            return (values ?? new List<string>())
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v.Trim())
                .Distinct()
                .ToList();
        }

        private List<AiEvaluationCriterionDto> DeserializeBreakdown(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<AiEvaluationCriterionDto>();

            try
            {
                return JsonSerializer.Deserialize<List<AiEvaluationCriterionDto>>(json, _jsonOptions) ?? new List<AiEvaluationCriterionDto>();
            }
            catch
            {
                return new List<AiEvaluationCriterionDto>();
            }
        }

        private class GeneratedRubricResponse
        {
            public string RubricSummary { get; set; } = string.Empty;
            public List<GeneratedRubricCriterion> Criteria { get; set; } = new();
        }

        private class GeneratedRubricCriterion
        {
            public string CriterionTitle { get; set; } = string.Empty;
            public string ExpectedConcept { get; set; } = string.Empty;
            public string ScoringGuidance { get; set; } = string.Empty;
            public decimal MaxMarks { get; set; }
            public List<string> Keywords { get; set; } = new();
            public List<string> CommonMistakes { get; set; } = new();
        }

        private class RawEvaluationResponse
        {
            public decimal AwardedMarks { get; set; }
            public string Summary { get; set; } = string.Empty;
            public List<string> Strengths { get; set; } = new();
            public List<string> MissingPoints { get; set; } = new();
            public List<string> IncorrectPoints { get; set; } = new();
            public decimal Confidence { get; set; }
            public bool ReviewRecommended { get; set; }
            public List<RawEvaluationCriterion> CriterionBreakdown { get; set; } = new();
        }

        private class RawEvaluationCriterion
        {
            public int RubricDetailId { get; set; }
            public string CriterionTitle { get; set; } = string.Empty;
            public decimal AwardedMarks { get; set; }
            public decimal MaxMarks { get; set; }
            public string Reason { get; set; } = string.Empty;
        }

        private class ValidatedEvaluation : AiNarrativeEvaluationDto
        {
        }
    }
}
