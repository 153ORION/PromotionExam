using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.DTOs.Marking;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ResultsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ResultsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("batch")]
        public async Task<IActionResult> GetResultsByBatch([FromQuery] int? batchId, [FromQuery] int? setId)
        {
            var query = _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .Where(r => r.IsActive == true)   // Item 13: never show inactive registrations
                .AsQueryable();

            if (batchId.HasValue && batchId.Value > 0)
                query = query.Where(r => r.BatchId == batchId.Value);

            if (setId.HasValue && setId.Value > 0)
                query = query.Where(r => r.QuestionSetId == setId.Value);

            var list = await query
                .OrderByDescending(r => r.TotalScore)
                .Select(r => new ExamineeResultSummaryDto
                {
                    ExamineeId = r.ExamineeId,
                    LoginId = r.User != null ? r.User.LoginId : "",
                    Name = r.User != null ? r.User.Name : "",
                    Designation = r.User != null ? r.User.Designation : null,
                    DepartmentName = r.User != null ? r.User.DepartmentName : null,
                    CompanyName = r.User != null ? r.User.CompanyName : null,
                    LocationName = r.User != null ? r.User.LocationName : null,
                    GradeName = r.User != null ? r.User.GradeName : null,
                    BatchName = r.Batch != null ? r.Batch.ExamName : null,
                    SetName = r.QuestionSet != null ? r.QuestionSet.SetName : null,
                    MCQScore = r.MCQScore ?? 0,
                    WrittenScore = r.WrittenScore ?? 0,
                    TotalScore = r.TotalScore ?? 0,
                    TotalPossibleMarks = r.Batch != null ? (r.Batch.TotalMark ?? 100) : 100,
                    IsPassed = (r.TotalScore ?? 0) >= ((r.Batch != null ? (r.Batch.TotalMark ?? 100) : 100) * 0.5m),
                    IsAttended = r.IsAttand == true,
                    ExamDate = r.ExamStart
                })
                .ToListAsync();

            return Ok(list);
        }

        [HttpGet("examinee/{examineeId}")]
        public async Task<IActionResult> GetExamineeFullResult(int examineeId)
        {
            var reg = await _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                return NotFound(new { message = "Examinee registration not found." });

            var narrativeDetails = await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == examineeId)
                .Include(s => s.Question)
                .Select(s => new
                {
                    s.QuestionId,
                    Question = s.Question != null ? s.Question.Question : "",
                    MaxMarks = s.Question != null ? s.Question.Marks : 0,
                    AwardedMarks = s.Marks,
                    s.Remarks
                })
                .ToListAsync();

            var result = new
            {
                reg.ExamineeId,
                LoginId = reg.User?.LoginId,
                Name = reg.User?.Name,
                Designation = reg.User?.Designation,
                DepartmentName = reg.User?.DepartmentName,
                CompanyName = reg.User?.CompanyName,
                LocationName = reg.User?.LocationName,
                GradeName = reg.User?.GradeName,
                BatchName = reg.Batch?.ExamName,
                SetName = reg.QuestionSet?.SetName,
                ExamYear = reg.Batch?.ExamYear,
                MCQScore = reg.MCQScore ?? 0,
                WrittenScore = reg.WrittenScore ?? 0,
                TotalScore = reg.TotalScore ?? 0,
                TotalPossibleMarks = reg.Batch?.TotalMark ?? 100,
                ExamStart = reg.ExamStart,
                ExamEnd = reg.ExamEnd,
                IsAttended = reg.IsAttand == true,
                Narratives = narrativeDetails
            };

            return Ok(result);
        }

        [HttpGet("answer-paper/{examineeId}")]
        public async Task<IActionResult> GetExamineeAnswerPaper(int examineeId)
        {
            var reg = await _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                return NotFound(new { message = "Examinee registration not found." });

            var assignedQuestionIds = await _context.ExamQuestionSheets
                .Where(s => s.ExamineeId == examineeId)
                .OrderBy(s => s.QuestionSeq)
                .ThenBy(s => s.QuestionId)
                .Select(s => s.QuestionId)
                .ToListAsync();

            List<QuestionBank> questions;
            if (assignedQuestionIds.Any())
            {
                var qList = await _context.QuestionBanks
                    .Where(q => assignedQuestionIds.Contains(q.QuestionId))
                    .Include(q => q.Answers)
                    .ToListAsync();

                questions = assignedQuestionIds
                    .Select(id => qList.FirstOrDefault(q => q.QuestionId == id))
                    .Where(q => q != null)
                    .Cast<QuestionBank>()
                    .ToList();
            }
            else
            {
                var answeredQuestionIds = await _context.ExamAnswerSheets
                    .Where(a => a.ExamineeId == examineeId)
                    .OrderBy(a => a.EAS_Id)
                    .Select(a => a.QuestionId)
                    .Distinct()
                    .ToListAsync();

                if (answeredQuestionIds.Any())
                {
                    var qList = await _context.QuestionBanks
                        .Where(q => answeredQuestionIds.Contains(q.QuestionId))
                        .Include(q => q.Answers)
                        .ToListAsync();

                    questions = answeredQuestionIds
                        .Select(id => qList.FirstOrDefault(q => q.QuestionId == id))
                        .Where(q => q != null)
                        .Cast<QuestionBank>()
                        .ToList();
                }
                else
                {
                    questions = await _context.QuestionBanks
                        .Where(q => q.SetId == reg.QuestionSetId && q.IsActive == true)
                        .Include(q => q.Answers)
                        .OrderBy(q => q.TypeId)
                        .ThenBy(q => q.QuestionId)
                        .ToListAsync();
                }
            }

            var answerSheets = (await _context.ExamAnswerSheets
                .Where(a => a.ExamineeId == examineeId)
                .ToListAsync())
                .GroupBy(a => a.QuestionId)
                .ToDictionary(g => g.Key, g => g.Last());

            var allNarrativeScores = await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == examineeId)
                .ToListAsync();

            var narrativeScoresGrouped = allNarrativeScores
                .GroupBy(s => s.QuestionId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var mcqQuestions = questions
                .Where(q => q.TypeId == 1)
                .Select(q =>
                {
                    var candAns = answerSheets.ContainsKey(q.QuestionId) ? answerSheets[q.QuestionId] : null;
                    var selectedOption = q.Answers.FirstOrDefault(a => a.AnswerId == candAns?.AnswerId);
                    var correctOption = q.Answers.FirstOrDefault(a => a.AnswerIsRight == 1);
                    bool isCorrect = correctOption != null && selectedOption != null && selectedOption.AnswerId == correctOption.AnswerId;

                    return new
                    {
                        q.QuestionId,
                        q.TypeId,
                        QuestionText = q.Question,
                        Marks = q.Marks,
                        Options = q.Answers.OrderBy(a => a.AnswerSerial).Select(a => new
                        {
                            a.AnswerId,
                            a.AnswerSerial,
                            a.AnswerDetails,
                            IsCorrectOption = a.AnswerIsRight == 1
                        }).ToList(),
                        CandidateAnswerId = candAns?.AnswerId,
                        CandidateAnswerText = selectedOption?.AnswerDetails,
                        CorrectAnswerId = correctOption?.AnswerId,
                        CorrectAnswerText = correctOption?.AnswerDetails,
                        IsCorrect = isCorrect,
                        AwardedMarks = isCorrect ? q.Marks : 0m
                    };
                }).ToList();

            var narrativeQuestions = questions
                .Where(q => q.TypeId == 2)
                .Select(q =>
                {
                    var candAns = answerSheets.ContainsKey(q.QuestionId) ? answerSheets[q.QuestionId] : null;
                    var qScores = narrativeScoresGrouped.ContainsKey(q.QuestionId) ? narrativeScoresGrouped[q.QuestionId] : new List<ExamNarrativeScore>();
                    var avgAwarded = qScores.Any() ? Math.Round(qScores.Average(s => s.Marks), 2) : 0m;
                    var lastScore = qScores.LastOrDefault();

                    return new
                    {
                        q.QuestionId,
                        q.TypeId,
                        QuestionText = q.Question,
                        MaxMarks = q.Marks,
                        ModelAnswer = q.NarrativeAnswer,
                        CandidateAnswerText = candAns?.Answer,
                        AwardedMarks = avgAwarded,
                        ExaminerRemarks = lastScore?.Remarks,
                        EvaluatedDate = lastScore?.EntryDate,
                        ExaminerCount = qScores.Select(s => s.ExaminerId).Distinct().Count()
                    };
                }).ToList();

            var totalPossibleMarks = reg.Batch?.TotalMark ?? (mcqQuestions.Sum(q => q.Marks) + narrativeQuestions.Sum(q => q.MaxMarks));
            var totalMcqMarks = mcqQuestions.Sum(q => q.AwardedMarks);
            var totalNarrativeMarks = narrativeQuestions.Sum(q => q.AwardedMarks);
            var totalEarnedMarks = totalMcqMarks + totalNarrativeMarks;

            var result = new
            {
                reg.ExamineeId,
                Candidate = new
                {
                    reg.HRRecordId,
                    LoginId = reg.User?.LoginId,
                    Name = reg.User?.Name,
                    Designation = reg.User?.Designation,
                    DepartmentName = reg.User?.DepartmentName,
                    CompanyName = reg.User?.CompanyName,
                    LocationName = reg.User?.LocationName,
                    GradeName = reg.User?.GradeName,
                    Email = reg.User?.Email,
                    Mobile = reg.User?.Mobile
                },
                Exam = new
                {
                    reg.BatchId,
                    BatchName = reg.Batch?.ExamName,
                    ExamYear = reg.Batch?.ExamYear,
                    reg.QuestionSetId,
                    SetName = reg.QuestionSet?.SetName,
                    ExamStart = reg.ExamStart,
                    ExamEnd = reg.ExamEnd,
                    IsAttended = reg.IsAttand == true,
                    IsCompleted = reg.IsExamEnd == true,
                    MCQScore = reg.MCQScore ?? totalMcqMarks,
                    WrittenScore = reg.WrittenScore ?? totalNarrativeMarks,
                    TotalScore = reg.TotalScore ?? totalEarnedMarks,
                    TotalPossibleMarks = totalPossibleMarks,
                    IsPassed = (reg.TotalScore ?? totalEarnedMarks) >= (totalPossibleMarks * 0.5m)
                },
                MCQQuestions = mcqQuestions,
                NarrativeQuestions = narrativeQuestions
            };

            return Ok(result);
        }
    }
}
