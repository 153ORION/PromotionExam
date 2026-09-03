using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

        public QuestionsController(ApplicationDbContext context)
        {
            _context = context;
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
        #endregion
    }
}
