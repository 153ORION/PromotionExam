using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
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
        private const string RubricPromptVersion = "rubric-v1";
        private const string EvaluationPromptVersion = "evaluation-v1";

        private readonly ApplicationDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public AiMarkingService(
            ApplicationDbContext context,
            HttpClient httpClient,
            IConfiguration configuration)
        {
            _context = context;
            _httpClient = httpClient;
            _configuration = configuration;
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

        public async Task<AiRubricDto> GenerateQuestionRubricAsync(int questionId, bool forceRegenerate, long requestedBy)
        {
            var question = await _context.QuestionBanks
                .Include(q => q.QuestionSet)
                .FirstOrDefaultAsync(q => q.QuestionId == questionId && q.TypeId == 2);

            if (question == null)
                throw new InvalidOperationException("Narrative question not found.");

            if (string.IsNullOrWhiteSpace(question.NarrativeAnswer))
                throw new InvalidOperationException("Standard answer is required before generating a rubric.");

            var currentHash = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);
            var subjectContext = await BuildSubjectContextAsync(question);

            var activeRubric = await _context.AiRubricMasters
                .Where(r => r.QuestionId == questionId && r.IsActive)
                .OrderByDescending(r => r.VersionNo)
                .FirstOrDefaultAsync();

            if (activeRubric != null && activeRubric.RubricHash == currentHash && !forceRegenerate)
                return MapRubric(activeRubric, question);

            var generated = await GenerateRubricFromOpenAiAsync(question, subjectContext);
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

            if (rubric == null)
                throw new InvalidOperationException("No AI rubric exists for this question.");

            var currentHash = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);
            if (!string.Equals(rubric.RubricHash, currentHash, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The active rubric is outdated. Regenerate the rubric before AI marking.");

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
                var rawEvaluation = await EvaluateWithOpenAiAsync(question, rubric, studentAnswer, subjectContext);
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

        private async Task<GeneratedRubricResponse> GenerateRubricFromOpenAiAsync(QuestionBank question, string? subjectContext)
        {
            var userPayload = JsonSerializer.Serialize(new
            {
                questionId = question.QuestionId,
                question = question.Question,
                subjectContext,
                fullMarks = question.Marks,
                standardAnswer = question.NarrativeAnswer,
                instruction = "Break the total marks into a reusable question-specific rubric. Accept semantic equivalents, not just exact wording."
            }, _jsonOptions);

            var schema = new
            {
                type = "object",
                additionalProperties = false,
                required = new[] { "rubricSummary", "criteria" },
                properties = new
                {
                    rubricSummary = new { type = "string" },
                    criteria = new
                    {
                        type = "array",
                        minItems = 1,
                        items = new
                        {
                            type = "object",
                            additionalProperties = false,
                            required = new[] { "criterionTitle", "expectedConcept", "scoringGuidance", "maxMarks", "keywords", "commonMistakes" },
                            properties = new
                            {
                                criterionTitle = new { type = "string" },
                                expectedConcept = new { type = "string" },
                                scoringGuidance = new { type = "string" },
                                maxMarks = new { type = "number" },
                                keywords = new { type = "array", items = new { type = "string" } },
                                commonMistakes = new { type = "array", items = new { type = "string" } }
                            }
                        }
                    }
                }
            };

            var systemPrompt =
                "You are an expert promotion-exam rubric designer. Create a reusable rubric from the teacher's standard answer. " +
                "Focus on key concepts, completeness, subject logic, and partial-credit boundaries. " +
                "The rubric must be question-specific, concise, and safe for repeated reuse across many employee answers.";

            return await SendStructuredPromptAsync<GeneratedRubricResponse>("rubric_generation", systemPrompt, userPayload, schema);
        }

        private async Task<RawEvaluationResponse> EvaluateWithOpenAiAsync(QuestionBank question, AiRubricMaster rubric, string studentAnswer, string? subjectContext)
        {
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
                instruction = "Mark like an experienced examiner. Accept correct meaning even with different wording. Award partial marks fairly. Penalize incorrect or irrelevant claims only when they materially harm correctness."
            }, _jsonOptions);

            var schema = new
            {
                type = "object",
                additionalProperties = false,
                required = new[] { "awardedMarks", "summary", "strengths", "missingPoints", "incorrectPoints", "confidence", "reviewRecommended", "criterionBreakdown" },
                properties = new
                {
                    awardedMarks = new { type = "number" },
                    summary = new { type = "string" },
                    strengths = new { type = "array", items = new { type = "string" } },
                    missingPoints = new { type = "array", items = new { type = "string" } },
                    incorrectPoints = new { type = "array", items = new { type = "string" } },
                    confidence = new { type = "number" },
                    reviewRecommended = new { type = "boolean" },
                    criterionBreakdown = new
                    {
                        type = "array",
                        minItems = 1,
                        items = new
                        {
                            type = "object",
                            additionalProperties = false,
                            required = new[] { "rubricDetailId", "criterionTitle", "awardedMarks", "maxMarks", "reason" },
                            properties = new
                            {
                                rubricDetailId = new { type = "integer" },
                                criterionTitle = new { type = "string" },
                                awardedMarks = new { type = "number" },
                                maxMarks = new { type = "number" },
                                reason = new { type = "string" }
                            }
                        }
                    }
                }
            };

            var systemPrompt =
                "You are an experienced examiner for promotion exams. Evaluate the student's narrative answer strictly against the saved rubric and not against wording alone. " +
                "Reward correct meaning, partial understanding, and subject-appropriate logic. " +
                "Return only the requested JSON.";

            return await SendStructuredPromptAsync<RawEvaluationResponse>("narrative_marking", systemPrompt, userPayload, schema);
        }

        private async Task<T> SendStructuredPromptAsync<T>(string schemaName, string systemPrompt, string userPayload, object schema)
        {
            var apiKey = _configuration["OpenAI:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("OpenAI API key is not configured on the server.");

            var endpoint = _configuration["OpenAI:ResponsesEndpoint"] ?? "https://api.openai.com/v1/responses";
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var request = new
            {
                model = GetModelName(),
                input = new object[]
                {
                    new
                    {
                        role = "system",
                        content = new object[]
                        {
                            new { type = "input_text", text = systemPrompt }
                        }
                    },
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new { type = "input_text", text = userPayload }
                        }
                    }
                },
                text = new
                {
                    format = new
                    {
                        type = "json_schema",
                        name = schemaName,
                        schema,
                        strict = true
                    },
                    verbosity = "low"
                }
            };

            using var content = new StringContent(JsonSerializer.Serialize(request, _jsonOptions), Encoding.UTF8, "application/json");
            using var response = await _httpClient.PostAsync(endpoint, content);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"OpenAI request failed: {(int)response.StatusCode} {response.ReasonPhrase}. {raw}");

            var jsonText = ExtractOutputText(raw);
            if (string.IsNullOrWhiteSpace(jsonText))
                throw new InvalidOperationException("OpenAI returned an empty structured response.");

            var result = JsonSerializer.Deserialize<T>(jsonText, _jsonOptions);
            if (result == null)
                throw new InvalidOperationException("Failed to parse OpenAI structured response.");

            return result;
        }

        private static string ExtractOutputText(string rawResponse)
        {
            using var document = JsonDocument.Parse(rawResponse);
            var root = document.RootElement;

            if (root.TryGetProperty("output_text", out var outputText) && outputText.ValueKind == JsonValueKind.String)
                return outputText.GetString() ?? string.Empty;

            if (root.TryGetProperty("output", out var output) && output.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in output.EnumerateArray())
                {
                    if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
                        continue;

                    foreach (var contentItem in content.EnumerateArray())
                    {
                        if (contentItem.TryGetProperty("text", out var textNode) && textNode.ValueKind == JsonValueKind.String)
                            return textNode.GetString() ?? string.Empty;
                    }
                }
            }

            return string.Empty;
        }

        private static void NormalizeRubric(GeneratedRubricResponse rubric, decimal maxMarks)
        {
            if (rubric.Criteria == null || rubric.Criteria.Count == 0)
                throw new InvalidOperationException("AI rubric generation returned no criteria.");

            rubric.Criteria = rubric.Criteria
                .Where(c => !string.IsNullOrWhiteSpace(c.CriterionTitle) && !string.IsNullOrWhiteSpace(c.ExpectedConcept))
                .ToList();

            if (!rubric.Criteria.Any())
                throw new InvalidOperationException("AI rubric generation returned only invalid criteria.");

            foreach (var criterion in rubric.Criteria)
            {
                if (criterion.MaxMarks <= 0)
                    throw new InvalidOperationException("AI rubric generation produced a criterion with zero or negative marks.");
            }

            var total = rubric.Criteria.Sum(c => c.MaxMarks);
            var diff = Math.Round(maxMarks - total, 2);

            if (diff != 0)
            {
                var tolerance = Math.Max(0.50m, Math.Round(maxMarks * 0.10m, 2));
                if (Math.Abs(diff) > tolerance)
                    throw new InvalidOperationException("AI rubric generation marks did not match the question total closely enough.");

                rubric.Criteria[^1].MaxMarks = Math.Round(rubric.Criteria[^1].MaxMarks + diff, 2);
                if (rubric.Criteria[^1].MaxMarks <= 0)
                    throw new InvalidOperationException("AI rubric normalization would create an invalid criterion mark.");
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
                Summary = "No answer was submitted, so no marks were awarded.",
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
                        Reason = "No relevant answer was provided."
                    })
                    .ToList(),
                ValidationStatus = "Validated",
                ValidationNotes = "Handled locally because the answer was empty.",
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
                    notes.Add($"Missing criterion breakdown for rubric detail #{detail.RubricDetailId}.");
                    normalizedBreakdown.Add(new AiEvaluationCriterionDto
                    {
                        RubricDetailId = detail.RubricDetailId,
                        CriterionTitle = detail.CriterionTitle,
                        AwardedMarks = 0,
                        MaxMarks = detail.MaxMarks,
                        Reason = "AI did not provide a criterion-level explanation."
                    });
                    continue;
                }

                var boundedMarks = Math.Round(rawItem!.AwardedMarks, 2);
                if (boundedMarks < 0)
                {
                    boundedMarks = 0;
                    notes.Add($"Negative marks were clamped for rubric detail #{detail.RubricDetailId}.");
                }
                if (boundedMarks > detail.MaxMarks)
                {
                    boundedMarks = detail.MaxMarks;
                    notes.Add($"Over-limit marks were clamped for rubric detail #{detail.RubricDetailId}.");
                }

                normalizedBreakdown.Add(new AiEvaluationCriterionDto
                {
                    RubricDetailId = detail.RubricDetailId,
                    CriterionTitle = string.IsNullOrWhiteSpace(rawItem.CriterionTitle) ? detail.CriterionTitle : rawItem.CriterionTitle.Trim(),
                    AwardedMarks = boundedMarks,
                    MaxMarks = detail.MaxMarks,
                    Reason = string.IsNullOrWhiteSpace(rawItem.Reason)
                        ? "AI did not provide a detailed reason."
                        : rawItem.Reason.Trim()
                });

                if (Math.Round(rawItem.MaxMarks, 2) != Math.Round(detail.MaxMarks, 2))
                    notes.Add($"Criterion max mark mismatch for rubric detail #{detail.RubricDetailId}.");
            }

            var extraBreakdowns = breakdownMap.Keys.Except(rubricCriteria.Select(d => d.RubricDetailId)).ToList();
            if (extraBreakdowns.Any())
                notes.Add($"Ignored {extraBreakdowns.Count} unexpected criterion entries from AI.");

            var totalAwarded = Math.Round(normalizedBreakdown.Sum(x => x.AwardedMarks), 2);
            if (totalAwarded > question.Marks)
            {
                notes.Add("Criterion total exceeded question marks and was reduced.");
                var overflow = totalAwarded - question.Marks;
                var last = normalizedBreakdown.Last();
                last.AwardedMarks = Math.Max(0, Math.Round(last.AwardedMarks - overflow, 2));
                totalAwarded = Math.Round(normalizedBreakdown.Sum(x => x.AwardedMarks), 2);
            }

            var confidence = response.Confidence;
            if (confidence < 0)
            {
                confidence = 0;
                notes.Add("Confidence was below 0 and was clamped.");
            }
            if (confidence > 1)
            {
                confidence = 1;
                notes.Add("Confidence was above 1 and was clamped.");
            }

            var summary = string.IsNullOrWhiteSpace(response.Summary)
                ? "AI evaluation generated without a narrative summary."
                : response.Summary.Trim();

            if (string.IsNullOrWhiteSpace(studentAnswer))
                notes.Add("Student answer snapshot was empty during evaluation.");

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
                ValidationNotes = notes.Any() ? string.Join(" ", notes) : "Validated against the saved rubric.",
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
            return _configuration["OpenAI:Model"] ?? "gpt-5-mini";
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
