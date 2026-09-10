using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Ai;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.Marking;
using PromotionExam.Application.DTOs.Questions;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;
using System.Text.Json;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class QuestionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IAiMarkingService _aiMarkingService;
        private readonly IUserActivityService _activityService;

        // Stored rubric criteria JSON is persisted with camelCase naming by AiMarkingService;
        // parsing must be case-insensitive to bind property names correctly.
        private static readonly JsonSerializerOptions RubricJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public QuestionsController(
            ApplicationDbContext context,
            IAiMarkingService aiMarkingService,
            IUserActivityService activityService)
        {
            _context = context;
            _aiMarkingService = aiMarkingService;
            _activityService = activityService;
        }

        private long GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            long.TryParse(userIdClaim, out var userId);
            return userId;
        }

        #region Question Sets
        [HttpGet("sets")]
        public async Task<IActionResult> GetSets([FromQuery] bool includeInactive = false)
        {
            var lookups = await _context.SysLookups.ToDictionaryAsync(l => l.LookupId, l => l.LookupText);

            var query = _context.QuestionSets.AsQueryable();
            if (!includeInactive)
            {
                query = query.Where(s => s.IsActive == true);
            }

            var sets = await query
                .OrderByDescending(s => s.SetId)
                .Select(s => new
                {
                    s.SetId,
                    s.SetName,
                    s.LocationId,
                    s.DepartmentId,
                    s.GradeId,
                    s.ConcentrationId,
                    s.IsActive,
                    s.EntryDate,
                    QuestionCount = _context.QuestionBanks.Count(q => q.SetId == s.SetId)
                })
                .ToListAsync();

            var result = sets.Select(s => new QuestionSetDto
            {
                SetId = s.SetId,
                SetName = s.SetName,
                LocationId = s.LocationId,
                LocationName = s.LocationId.HasValue && lookups.ContainsKey(s.LocationId.Value) ? lookups[s.LocationId.Value] : null,
                DepartmentId = s.DepartmentId,
                DepartmentName = s.DepartmentId.HasValue && lookups.ContainsKey(s.DepartmentId.Value) ? lookups[s.DepartmentId.Value] : null,
                GradeId = s.GradeId,
                GradeName = s.GradeId.HasValue && lookups.ContainsKey(s.GradeId.Value) ? lookups[s.GradeId.Value] : null,
                ConcentrationId = s.ConcentrationId,
                ConcentrationName = s.ConcentrationId.HasValue && lookups.ContainsKey(s.ConcentrationId.Value) ? lookups[s.ConcentrationId.Value] : null,
                IsActive = s.IsActive,
                QuestionCount = s.QuestionCount,
                EntryDate = s.EntryDate
            }).ToList();

            return Ok(result);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("sets")]
        public async Task<IActionResult> SaveSet([FromBody] QuestionSetCreateUpdateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.SetName))
                return BadRequest(new { message = "Set name is required." });

            if (dto.SetId.HasValue && dto.SetId.Value > 0)
            {
                var existing = await _context.QuestionSets.FindAsync(dto.SetId.Value);
                if (existing == null)
                    return NotFound(new { message = "Question Set not found." });

                existing.SetName = dto.SetName.Trim();
                existing.DepartmentId = dto.DepartmentId;
                existing.GradeId = dto.GradeId;
                existing.LocationId = dto.LocationId;
                existing.ConcentrationId = dto.ConcentrationId;
                existing.UpdateDate = DateTime.Now;
            }
            else
            {
                var newSet = new QuestionSet
                {
                    SetName = dto.SetName.Trim(),
                    DepartmentId = dto.DepartmentId,
                    GradeId = dto.GradeId,
                    LocationId = dto.LocationId,
                    ConcentrationId = dto.ConcentrationId,
                    IsActive = true,
                    EntryDate = DateTime.Now
                };
                _context.QuestionSets.Add(newSet);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Question Set saved successfully." });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("sets/toggle/{id}")]
        public async Task<IActionResult> ToggleSetStatus(int id)
        {
            var set = await _context.QuestionSets.FindAsync(id);
            if (set == null)
                return NotFound(new { message = "Question Set not found." });

            set.IsActive = !(set.IsActive == true);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Status changed successfully.", isActive = set.IsActive });
        }
        #endregion

        #region Questions (MCQ & Narrative)
        [HttpGet]
        public async Task<IActionResult> GetQuestions([FromQuery] int? setId, [FromQuery] int? typeId)
        {
            var query = _context.QuestionBanks
                .Include(q => q.QuestionSet)
                .Include(q => q.Answers)
                .AsQueryable();

            if (setId.HasValue && setId.Value > 0)
                query = query.Where(q => q.SetId == setId.Value);

            if (typeId.HasValue && typeId.Value > 0)
                query = query.Where(q => q.TypeId == typeId.Value);

            var questions = await query
                .OrderByDescending(q => q.QuestionId)
                .Select(q => new QuestionBankDto
                {
                    QuestionId = q.QuestionId,
                    SetId = q.SetId,
                    SetName = q.QuestionSet != null ? q.QuestionSet.SetName : null,
                    TypeId = q.TypeId,
                    Question = q.Question,
                    NarrativeAnswer = q.NarrativeAnswer,
                    Marks = q.Marks,
                    IsActive = q.IsActive,
                    EntryDate = q.EntryDate,
                    Answers = q.Answers.OrderBy(a => a.AnswerSerial).Select(a => new QuestionOptionDto
                    {
                        AnswerId = a.AnswerId,
                        AnswerDetails = a.AnswerDetails,
                        AnswerSerial = a.AnswerSerial,
                        IsRight = a.AnswerIsRight == 1
                    }).ToList()
                })
                .ToListAsync();

            var narrativeQuestions = questions.Where(q => q.TypeId == 2).ToList();
            if (narrativeQuestions.Any())
            {
                var rubricMap = await _context.AiRubricMasters
                    .Where(r => narrativeQuestions.Select(q => q.QuestionId).Contains(r.QuestionId) && r.IsActive)
                    .GroupBy(r => r.QuestionId)
                    .Select(g => g.OrderByDescending(x => x.VersionNo).First())
                    .ToDictionaryAsync(r => r.QuestionId, r => r);

                foreach (var narrative in narrativeQuestions)
                {
                    if (!rubricMap.TryGetValue(narrative.QuestionId, out var rubric))
                    {
                        narrative.AiRubricStatus = "NotGenerated";
                        continue;
                    }

                    var fingerprint = AiRubricFingerprint.Create(narrative.Question, narrative.NarrativeAnswer, narrative.Marks);
                    var outdated = !string.Equals(rubric.RubricHash, fingerprint, StringComparison.OrdinalIgnoreCase);
                    narrative.AiRubricStatus = outdated ? "Outdated" : "Ready";
                    narrative.AiRubricVersionNo = rubric.VersionNo;
                    narrative.AiRubricNeedsRegeneration = outdated;
                    narrative.AiRubricCriteriaCount = CountRubricCriteria(rubric.CriteriaJson);
                    narrative.AiRubricSummary = rubric.RubricSummary;
                    narrative.AiRubricGeneratedAt = rubric.EntryDate;
                }
            }

            return Ok(questions);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetQuestionById(int id)
        {
            var q = await _context.QuestionBanks
                .Include(x => x.QuestionSet)
                .Include(x => x.Answers)
                .FirstOrDefaultAsync(x => x.QuestionId == id);

            if (q == null)
                return NotFound();

            var dto = new QuestionBankDto
            {
                QuestionId = q.QuestionId,
                SetId = q.SetId,
                SetName = q.QuestionSet != null ? q.QuestionSet.SetName : null,
                TypeId = q.TypeId,
                Question = q.Question,
                NarrativeAnswer = q.NarrativeAnswer,
                Marks = q.Marks,
                IsActive = q.IsActive,
                EntryDate = q.EntryDate,
                Answers = q.Answers.OrderBy(a => a.AnswerSerial).Select(a => new QuestionOptionDto
                {
                    AnswerId = a.AnswerId,
                    AnswerDetails = a.AnswerDetails,
                    AnswerSerial = a.AnswerSerial,
                    IsRight = a.AnswerIsRight == 1
                }).ToList()
            };

            if (q.TypeId == 2)
            {
                var rubric = await _context.AiRubricMasters
                    .Where(r => r.QuestionId == q.QuestionId && r.IsActive)
                    .OrderByDescending(r => r.VersionNo)
                    .FirstOrDefaultAsync();

                if (rubric == null)
                {
                    dto.AiRubricStatus = "NotGenerated";
                }
                else
                {
                    var fingerprint = AiRubricFingerprint.Create(q.Question, q.NarrativeAnswer, q.Marks);
                    var outdated = !string.Equals(rubric.RubricHash, fingerprint, StringComparison.OrdinalIgnoreCase);
                    dto.AiRubricStatus = outdated ? "Outdated" : "Ready";
                    dto.AiRubricVersionNo = rubric.VersionNo;
                    dto.AiRubricNeedsRegeneration = outdated;
                    dto.AiRubricCriteriaCount = CountRubricCriteria(rubric.CriteriaJson);
                    dto.AiRubricSummary = rubric.RubricSummary;
                    dto.AiRubricGeneratedAt = rubric.EntryDate;
                }
            }

            return Ok(dto);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SaveQuestion([FromBody] QuestionCreateUpdateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Question))
                return BadRequest(new { message = "Question text is required." });

            if (dto.SetId <= 0)
                return BadRequest(new { message = "Valid Question Set must be selected." });

            if (dto.TypeId == 1 && (!dto.Options.Any() || !dto.Options.Any(o => o.IsRight)))
                return BadRequest(new { message = "MCQ question must have at least one marked correct option." });

            QuestionBank question;
            if (dto.QuestionId.HasValue && dto.QuestionId.Value > 0)
            {
                var existing = await _context.QuestionBanks
                    .Include(q => q.Answers)
                    .FirstOrDefaultAsync(q => q.QuestionId == dto.QuestionId.Value);

                if (existing == null)
                    return NotFound(new { message = "Question not found." });

                existing.SetId = dto.SetId;
                existing.TypeId = dto.TypeId;
                existing.Question = dto.Question.Trim();
                existing.NarrativeAnswer = dto.TypeId == 2 ? dto.NarrativeAnswer?.Trim() : null;
                existing.Marks = dto.Marks;

                // Update options if MCQ
                if (dto.TypeId == 1)
                {
                    _context.QuestionBankAnswers.RemoveRange(existing.Answers);
                    int serial = 1;
                    foreach (var opt in dto.Options)
                    {
                        existing.Answers.Add(new QuestionBankAnswer
                        {
                            AnswerDetails = opt.AnswerDetails.Trim(),
                            AnswerSerial = serial++,
                            AnswerIsRight = opt.IsRight ? 1 : 0,
                            EntryDate = DateTime.Now
                        });
                    }
                }
                question = existing;
            }
            else
            {
                question = new QuestionBank
                {
                    SetId = dto.SetId,
                    TypeId = dto.TypeId,
                    Question = dto.Question.Trim(),
                    NarrativeAnswer = dto.TypeId == 2 ? dto.NarrativeAnswer?.Trim() : null,
                    Marks = dto.Marks,
                    IsActive = true,
                    EntryDate = DateTime.Now
                };

                if (dto.TypeId == 1)
                {
                    int serial = 1;
                    foreach (var opt in dto.Options)
                    {
                        question.Answers.Add(new QuestionBankAnswer
                        {
                            AnswerDetails = opt.AnswerDetails.Trim(),
                            AnswerSerial = serial++,
                            AnswerIsRight = opt.IsRight ? 1 : 0,
                            EntryDate = DateTime.Now
                        });
                    }
                }
                _context.QuestionBanks.Add(question);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Question saved successfully.", questionId = question.QuestionId });
        }

        [HttpGet("{id}/ai-rubric")]
        public async Task<IActionResult> GetAiRubric(int id)
        {
            var rubric = await _aiMarkingService.GetQuestionRubricAsync(id);
            if (rubric == null)
                return NotFound(new { message = "Narrative question not found." });

            return Ok(rubric);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("{id}/ai-rubric/generate")]
        public async Task<IActionResult> GenerateAiRubric(int id, [FromQuery] bool forceRegenerate = false)
        {
            try
            {
                var userId = GetCurrentUserId();
                var rubric = await _aiMarkingService.GenerateQuestionRubricAsync(id, forceRegenerate, userId);

                var actor = await _context.SysUserRegistrations.FindAsync(userId);
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _activityService.LogAsync(
                    userId,
                    actor?.LoginId ?? userId.ToString(),
                    actor?.Name ?? "User",
                    "Admin",
                    "AI_MARKING",
                    forceRegenerate ? "AI_RUBRIC_REGENERATE" : "AI_RUBRIC_GENERATE",
                    $"AI rubric {(forceRegenerate ? "re" : string.Empty)}generated for Question #{id}, version {rubric.VersionNo}.",
                    ip);

                return Ok(new
                {
                    message = forceRegenerate ? "AI rubric regenerated successfully." : "AI rubric generated successfully.",
                    rubric
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("{id}/standard-answer/generate")]
        public async Task<IActionResult> GenerateStandardAnswer(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var answer = await _aiMarkingService.GenerateStandardAnswerAsync(id, userId);

                var actor = await _context.SysUserRegistrations.FindAsync(userId);
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _activityService.LogAsync(
                    userId,
                    actor?.LoginId ?? userId.ToString(),
                    actor?.Name ?? "User",
                    "Admin",
                    "AI_MARKING",
                    "AI_GENERATE_STANDARD_ANSWER",
                    $"Generated standard reference answer for Question #{id} using Google Gemini.",
                    ip);

                return Ok(new GenerateStandardAnswerResponseDto
                {
                    QuestionId = id,
                    StandardAnswer = answer,
                    Message = "Standard model answer generated successfully using Google Gemini."
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("sets/{setId}/rubrics")]
        public async Task<IActionResult> GetSetRubricsForViewer(int setId)
        {
            var questionSet = await _context.QuestionSets.FindAsync(setId);
            if (questionSet == null)
                return NotFound(new { message = "Question Set not found." });

            // Rubrics Viewer shows only Narrative questions (TypeId == 2) of the selected set.
            // IsActive is nullable in Question_Bank: include NULL (legacy rows), exclude explicitly deactivated.
            var narrativeQuestions = await _context.QuestionBanks
                .Where(q => q.SetId == setId && q.TypeId == 2 && q.IsActive != false)
                .OrderBy(q => q.QuestionId)
                .ToListAsync();

            var questionIds = narrativeQuestions.Select(q => q.QuestionId).ToList();
            var activeRubrics = questionIds.Any()
                ? await _context.AiRubricMasters
                    .Where(r => questionIds.Contains(r.QuestionId) && r.IsActive)
                    .GroupBy(r => r.QuestionId)
                    .Select(g => g.OrderByDescending(x => x.VersionNo).First())
                    .ToDictionaryAsync(r => r.QuestionId, r => r)
                : new Dictionary<int, AiRubricMaster>();

            var questions = new List<RubricViewerQuestionDto>();
            foreach (var q in narrativeQuestions)
            {
                var dto = new RubricViewerQuestionDto
                {
                    QuestionId = q.QuestionId,
                    Question = q.Question,
                    Marks = q.Marks,
                    NarrativeAnswer = q.NarrativeAnswer
                };

                if (activeRubrics.TryGetValue(q.QuestionId, out var rubric))
                {
                    var fingerprint = AiRubricFingerprint.Create(q.Question, q.NarrativeAnswer, q.Marks);
                    var outdated = !string.Equals(rubric.RubricHash, fingerprint, StringComparison.OrdinalIgnoreCase);

                    dto.RubricStatus = outdated ? "Outdated" : "Ready";
                    dto.RubricVersionNo = rubric.VersionNo;
                    dto.RubricSummary = rubric.RubricSummary;
                    dto.RubricSourceModel = rubric.SourceModel;
                    dto.RubricGeneratedAt = rubric.EntryDate;
                    dto.Criteria = ParseRubricCriteria(rubric.CriteriaJson);
                }

                questions.Add(dto);
            }

            return Ok(new RubricViewerResponseDto
            {
                SetId = setId,
                SetName = questionSet.SetName,
                TotalQuestions = questions.Count,
                Questions = questions
            });
        }

        private static List<AiRubricCriterionDto> ParseRubricCriteria(string? criteriaJson)
        {
            if (string.IsNullOrWhiteSpace(criteriaJson))
                return new List<AiRubricCriterionDto>();

            try
            {
                return JsonSerializer.Deserialize<List<AiRubricCriterionDto>>(criteriaJson, RubricJsonOptions)
                    ?? new List<AiRubricCriterionDto>();
            }
            catch
            {
                return new List<AiRubricCriterionDto>();
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("sets/{setId}/generate-rubrics")]
        public async Task<IActionResult> GenerateSetRubrics(
            int setId,
            [FromQuery] bool onlyMissing = true,
            [FromQuery] bool forceRegenerate = false)
        {
            var questionSet = await _context.QuestionSets.FindAsync(setId);
            if (questionSet == null)
                return NotFound(new { message = "Question Set not found." });

            var narrativeQuestions = await _context.QuestionBanks
                .Where(q => q.SetId == setId && q.TypeId == 2)
                .OrderBy(q => q.QuestionId)
                .ToListAsync();

            if (!narrativeQuestions.Any())
            {
                return Ok(new
                {
                    setId,
                    setName = questionSet.SetName,
                    totalQuestions = 0,
                    generatedCount = 0,
                    skippedCount = 0,
                    failedCount = 0,
                    results = new List<object>()
                });
            }

            var questionIds = narrativeQuestions.Select(q => q.QuestionId).ToList();
            var activeRubrics = await _context.AiRubricMasters
                .Where(r => questionIds.Contains(r.QuestionId) && r.IsActive)
                .GroupBy(r => r.QuestionId)
                .Select(g => g.OrderByDescending(x => x.VersionNo).First())
                .ToDictionaryAsync(r => r.QuestionId, r => r);

            var userId = GetCurrentUserId();
            var results = new List<object>();
            int generatedCount = 0;
            int skippedCount = 0;
            int failedCount = 0;

            foreach (var q in narrativeQuestions)
            {
                if (string.IsNullOrWhiteSpace(q.NarrativeAnswer))
                {
                    skippedCount++;
                    results.Add(new
                    {
                        questionId = q.QuestionId,
                        question = q.Question,
                        status = "Skipped",
                        message = "Standard model answer is missing. Please define a standard answer first."
                    });
                    continue;
                }

                bool hasRubric = activeRubrics.TryGetValue(q.QuestionId, out var existingRubric);
                var fingerprint = AiRubricFingerprint.Create(q.Question, q.NarrativeAnswer, q.Marks);
                bool isOutdated = hasRubric && !string.Equals(existingRubric!.RubricHash, fingerprint, StringComparison.OrdinalIgnoreCase);

                if (onlyMissing && hasRubric && !isOutdated && !forceRegenerate)
                {
                    skippedCount++;
                    results.Add(new
                    {
                        questionId = q.QuestionId,
                        question = q.Question,
                        status = "AlreadyGenerated",
                        versionNo = existingRubric!.VersionNo,
                        message = "Rubric already exists and is up to date."
                    });
                    continue;
                }

                try
                {
                    bool shouldForce = forceRegenerate || isOutdated;
                    var rubric = await _aiMarkingService.GenerateQuestionRubricAsync(q.QuestionId, shouldForce, userId);
                    generatedCount++;
                    results.Add(new
                    {
                        questionId = q.QuestionId,
                        question = q.Question,
                        status = "Generated",
                        versionNo = rubric.VersionNo,
                        criteriaCount = rubric.Criteria.Count,
                        rubricSummary = rubric.RubricSummary,
                        message = shouldForce ? "Rubric regenerated successfully." : "Rubric generated successfully."
                    });
                }
                catch (Exception ex)
                {
                    failedCount++;
                    results.Add(new
                    {
                        questionId = q.QuestionId,
                        question = q.Question,
                        status = "Failed",
                        message = ex.Message
                    });
                }
            }

            var actor = await _context.SysUserRegistrations.FindAsync(userId);
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                userId,
                actor?.LoginId ?? userId.ToString(),
                actor?.Name ?? "User",
                "Admin",
                "AI_MARKING",
                "AI_RUBRIC_BATCH_GENERATE",
                $"AI rubric batch generated for Question Set #{setId} ({questionSet.SetName}): {generatedCount} generated, {skippedCount} skipped, {failedCount} failed.",
                ip);

            return Ok(new
            {
                setId,
                setName = questionSet.SetName,
                totalQuestions = narrativeQuestions.Count,
                generatedCount,
                skippedCount,
                failedCount,
                results
            });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteQuestion(int id)
        {
            var question = await _context.QuestionBanks
                .Include(q => q.Answers)
                .FirstOrDefaultAsync(q => q.QuestionId == id);

            if (question == null)
                return NotFound(new { message = "Question not found." });

            _context.QuestionBanks.Remove(question);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Question deleted successfully." });
        }

        private static int CountRubricCriteria(string? criteriaJson)
        {
            if (string.IsNullOrWhiteSpace(criteriaJson))
                return 0;

            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<object>>(criteriaJson)?.Count ?? 0;
            }
            catch
            {
                return 0;
            }
        }
        #endregion
    }
}
