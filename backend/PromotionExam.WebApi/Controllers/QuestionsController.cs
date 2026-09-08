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
using PromotionExam.Application.DTOs.Questions;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

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
        public async Task<IActionResult> GetSets()
        {
            var lookups = await _context.SysLookups.ToDictionaryAsync(l => l.LookupId, l => l.LookupText);

            var sets = await _context.QuestionSets
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
                existing.UpdateDate = DateTime.UtcNow;
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
                    EntryDate = DateTime.UtcNow
                };
                _context.QuestionSets.Add(newSet);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Question Set saved successfully." });
        }

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
                            EntryDate = DateTime.UtcNow
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
                    EntryDate = DateTime.UtcNow
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
                            EntryDate = DateTime.UtcNow
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
