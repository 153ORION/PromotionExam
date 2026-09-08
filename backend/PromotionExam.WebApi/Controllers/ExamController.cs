using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ExamController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly PromotionExam.Application.Common.Interfaces.IUserActivityService _activityService;
        private readonly PromotionExam.Application.Common.Interfaces.ICandidateExamService _candidateExamService;

        public ExamController(
            ApplicationDbContext context,
            PromotionExam.Application.Common.Interfaces.IUserActivityService activityService,
            PromotionExam.Application.Common.Interfaces.ICandidateExamService candidateExamService)
        {
            _context = context;
            _activityService = activityService;
            _candidateExamService = candidateExamService;
        }

        [HttpGet("my-exams")]
        public async Task<IActionResult> GetMyExams()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var hrRecordId))
                return Unauthorized();

            var exams = await _context.ExamRegistrations
                .Where(r => r.HRRecordId == hrRecordId && r.IsActive == true)
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .OrderByDescending(r => r.ExamineeId)
                .Select(r => new
                {
                    r.ExamineeId,
                    r.BatchId,
                    BatchName = r.Batch != null ? r.Batch.ExamName : "",
                    r.QuestionSetId,
                    SetName = r.QuestionSet != null ? r.QuestionSet.SetName : "",
                    DurationMinutes = r.Batch != null ? r.Batch.ExamDuration : 60,
                    r.ExamStart,
                    r.ExamEnd,
                    r.IsAttand,
                    r.IsExamEnd,
                    r.IsTimeExpire,
                    r.TotalScore
                })
                .ToListAsync();

            return Ok(exams);
        }

        [HttpPost("start/{examineeId}")]
        public async Task<IActionResult> StartExam(int examineeId)
        {
            var reg = await _context.ExamRegistrations
                .Include(r => r.Batch)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                return NotFound(new { message = "Exam registration not found." });

            if (reg.IsExamEnd == true)
                return BadRequest(new { message = "You have already completed and submitted this examination." });

            if (reg.IsAttand != true || reg.ExamStart == null)
            {
                try
                {
                    // Execute stored procedure SP_APP_EXAM_START to pick questions and initialize exam
                    await _context.Database.OpenConnectionAsync();
                    try
                    {
                        using var cmd = _context.Database.GetDbConnection().CreateCommand();
                        cmd.CommandText = "dbo.SP_APP_EXAM_START";
                        cmd.CommandType = CommandType.StoredProcedure;

                        var pExamineeId = cmd.CreateParameter();
                        pExamineeId.ParameterName = "@ExamineeId";
                        pExamineeId.Value = examineeId;
                        cmd.Parameters.Add(pExamineeId);

                        var pAction = cmd.CreateParameter();
                        pAction.ParameterName = "@Action";
                        pAction.Value = "Q";
                        cmd.Parameters.Add(pAction);

                        using var reader = await cmd.ExecuteReaderAsync();
                        if (await reader.ReadAsync())
                        {
                            var statusMessage = reader["statusMessage"]?.ToString();
                            if (!string.IsNullOrEmpty(statusMessage) &&
                                statusMessage.Contains("Not enough question", StringComparison.OrdinalIgnoreCase))
                            {
                                return BadRequest(new { message = statusMessage });
                            }
                        }
                    }
                    finally
                    {
                        await _context.Database.CloseConnectionAsync();
                    }

                    // Reload the updated ExamRegistration entity populated by the stored procedure
                    await _context.Entry(reg).ReloadAsync();
                    if (reg.BatchId > 0)
                    {
                        await _context.Entry(reg).Reference(r => r.Batch).LoadAsync();
                    }

                    var duration = reg.Batch?.ExamDuration ?? 60;
                    var user = await _context.SysUserRegistrations.FindAsync(reg.HRRecordId);
                    var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                    await _activityService.LogAsync(
                        reg.HRRecordId,
                        user?.LoginId ?? reg.HRRecordId.ToString(),
                        user?.Name ?? "Examinee",
                        "Examinee",
                        "EXAM",
                        "START_EXAM",
                        $"Candidate '{user?.Name}' started examination '{reg.Batch?.ExamName}' (Duration: {duration} mins).",
                        ip);
                }
                catch (Exception ex)
                {
                    return StatusCode(500, new { message = "Failed to start examination: " + ex.Message });
                }
            }

            return Ok(new
            {
                reg.ExamineeId,
                reg.ExamStart,
                reg.ExamEnd,
                RemainingSeconds = reg.ExamEnd.HasValue ? Math.Max(0, (int)(reg.ExamEnd.Value - DateTime.UtcNow).TotalSeconds) : 3600
            });
        }

        [HttpGet("paper/{examineeId}")]
        public async Task<IActionResult> GetExamPaper(int examineeId)
        {
            var reg = await _context.ExamRegistrations
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                return NotFound(new { message = "Exam registration not found." });

            // Load questions assigned in Exam_Question_Sheet if present, otherwise fall back to full set
            var assignedQuestionIds = await _context.ExamQuestionSheets
                .Where(s => s.ExamineeId == examineeId && s.IsActive == true)
                .OrderBy(s => s.QuestionSeq)
                .Select(s => s.QuestionId)
                .ToListAsync();

            List<object> questions;
            if (assignedQuestionIds.Any())
            {
                var qList = await _context.QuestionBanks
                    .Where(q => assignedQuestionIds.Contains(q.QuestionId) && q.IsActive == true)
                    .Include(q => q.Answers)
                    .ToListAsync();

                questions = assignedQuestionIds
                    .Select(id => qList.FirstOrDefault(q => q.QuestionId == id))
                    .Where(q => q != null)
                    .Select(q => (object)new
                    {
                        q!.QuestionId,
                        q.TypeId,
                        q.Question,
                        q.Marks,
                        Answers = q.Answers.OrderBy(a => a.AnswerSerial).Select(a => new
                        {
                            a.AnswerId,
                            a.AnswerDetails,
                            a.AnswerSerial
                        }).ToList()
                    })
                    .ToList();
            }
            else
            {
                var rawQuestions = await _context.QuestionBanks
                    .Where(q => q.SetId == reg.QuestionSetId && q.IsActive == true)
                    .Include(q => q.Answers)
                    .OrderBy(q => q.TypeId)
                    .ThenBy(q => q.QuestionId)
                    .Select(q => new
                    {
                        q.QuestionId,
                        q.TypeId,
                        q.Question,
                        q.Marks,
                        Answers = q.Answers.OrderBy(a => a.AnswerSerial).Select(a => new
                        {
                            a.AnswerId,
                            a.AnswerDetails,
                            a.AnswerSerial
                        }).ToList()
                    })
                    .ToListAsync();
                questions = rawQuestions.Cast<object>().ToList();
            }

            // Load any existing candidate answers
            var savedAnswers = await _context.ExamAnswerSheets
                .Where(a => a.ExamineeId == examineeId)
                .ToDictionaryAsync(a => a.QuestionId, a => new { a.AnswerId, a.Answer });

            var remainingSeconds = reg.ExamEnd.HasValue ? Math.Max(0, (int)(reg.ExamEnd.Value - DateTime.UtcNow).TotalSeconds) : 3600;

            return Ok(new
            {
                reg.ExamineeId,
                reg.BatchId,
                BatchName = reg.Batch?.ExamName,
                reg.QuestionSetId,
                SetName = reg.QuestionSet?.SetName,
                reg.ExamStart,
                reg.ExamEnd,
                reg.IsExamEnd,
                RemainingSeconds = remainingSeconds,
                Questions = questions,
                SavedAnswers = savedAnswers
            });
        }

        public class SaveAnswerDto
        {
            public int ExamineeId { get; set; }
            public int QuestionId { get; set; }
            public int? AnswerId { get; set; }
            public string? Answer { get; set; }
        }

        [HttpPost("save-answer")]
        public async Task<IActionResult> SaveAnswer([FromBody] SaveAnswerDto dto)
        {
            var existing = await _context.ExamAnswerSheets
                .FirstOrDefaultAsync(a => a.ExamineeId == dto.ExamineeId && a.QuestionId == dto.QuestionId);

            if (existing != null)
            {
                existing.AnswerId = dto.AnswerId;
                existing.Answer = dto.Answer;
            }
            else
            {
                var sheet = new ExamAnswerSheet
                {
                    ExamineeId = dto.ExamineeId,
                    QuestionId = dto.QuestionId,
                    AnswerId = dto.AnswerId,
                    Answer = dto.Answer,
                    EntryDate = DateTime.UtcNow
                };
                _context.ExamAnswerSheets.Add(sheet);
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("submit/{examineeId}")]
        public async Task<IActionResult> SubmitExam(int examineeId)
        {
            var reg = await _context.ExamRegistrations.FindAsync(examineeId);
            if (reg == null)
                return NotFound(new { message = "Exam registration not found." });

            if (reg.IsExamEnd == true)
                return Ok(new { message = "Exam already submitted." });

            // Automatically grade MCQ questions
            var mcqQuestions = await _context.QuestionBanks
                .Where(q => q.SetId == reg.QuestionSetId && q.TypeId == 1)
                .Include(q => q.Answers)
                .ToListAsync();

            var candidateAnswers = await _context.ExamAnswerSheets
                .Where(a => a.ExamineeId == examineeId)
                .ToListAsync();

            decimal totalMcqScore = 0;
            foreach (var q in mcqQuestions)
            {
                var correctAnswer = q.Answers.FirstOrDefault(a => a.AnswerIsRight == 1);
                var candidateAns = candidateAnswers.FirstOrDefault(a => a.QuestionId == q.QuestionId);

                if (correctAnswer != null && candidateAns != null && candidateAns.AnswerId == correctAnswer.AnswerId)
                {
                    totalMcqScore += q.Marks;
                }
            }

            reg.MCQScore = totalMcqScore;
            reg.TotalScore = totalMcqScore + (reg.WrittenScore ?? 0);
            reg.IsExamEnd = true;
            reg.LastUpdateTime = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var user = await _context.SysUserRegistrations.FindAsync(reg.HRRecordId);
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                reg.HRRecordId,
                user?.LoginId ?? reg.HRRecordId.ToString(),
                user?.Name ?? "Examinee",
                "Examinee",
                "EXAM",
                "SUBMIT_EXAM",
                $"Candidate '{user?.Name}' submitted exam. Auto-evaluated MCQ score: {totalMcqScore} marks.",
                ip,
                System.Text.Json.JsonSerializer.Serialize(new { mcqScore = totalMcqScore }));

            return Ok(new
            {
                message = "Examination submitted successfully!",
                mcqScore = totalMcqScore,
                isCompleted = true
            });
        }

        #region -------- API Project Candidate Attempt Endpoints --------

        [AllowAnonymous]
        [HttpGet("getExamInfo")]
        public async Task<PromotionExam.Application.DTOs.CandidateAttempt.ResponseDTO> getExamInfo([FromQuery] int hrrecordId)
        {
            return await _candidateExamService.GetExamInfo(hrrecordId);
        }

        [AllowAnonymous]
        [HttpGet("examStart")]
        public async Task<PromotionExam.Application.DTOs.CandidateAttempt.ResponseDTO> examStart([FromQuery] int examineeId)
        {
            return await _candidateExamService.ExamStart(examineeId);
        }

        [AllowAnonymous]
        [HttpGet("checkExamState")]
        public async Task<PromotionExam.Application.DTOs.CandidateAttempt.ResponseDTO> checkExamState([FromQuery] int examineeId)
        {
            return await _candidateExamService.CheckExamState(examineeId);
        }

        [AllowAnonymous]
        [HttpGet("answerSheet")]
        public async Task<PromotionExam.Application.DTOs.CandidateAttempt.ResponseDTO> answerSheet([FromQuery] int examineeId)
        {
            return await _candidateExamService.AnswerSheet(examineeId);
        }

        [AllowAnonymous]
        [HttpPost("submitAnswer")]
        public async Task<PromotionExam.Application.DTOs.CandidateAttempt.ResponseDTO> submitAnswer([FromBody] PromotionExam.Application.DTOs.CandidateAttempt.SubmitAnsDTO ansDTO)
        {
            return await _candidateExamService.SubmitAnswer(ansDTO.examineeId, ansDTO.questionId, ansDTO.answerId, ansDTO.answer);
        }

        [AllowAnonymous]
        [HttpPost("examEnd")]
        public async Task<PromotionExam.Application.DTOs.CandidateAttempt.ResponseDTO> examEnd([FromBody] PromotionExam.Application.DTOs.CandidateAttempt.ExamFinishDTO examFinishDTO)
        {
            return await _candidateExamService.ExamEnd(examFinishDTO);
        }

        #endregion
    }
}
