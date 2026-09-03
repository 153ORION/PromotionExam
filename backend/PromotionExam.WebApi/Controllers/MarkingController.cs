using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
    public class MarkingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly PromotionExam.Application.Common.Interfaces.IUserActivityService _activityService;

        public MarkingController(
            ApplicationDbContext context,
            PromotionExam.Application.Common.Interfaces.IUserActivityService activityService)
        {
            _context = context;
            _activityService = activityService;
        }

        private long GetCurrentExaminerId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            long.TryParse(userIdClaim, out var examinerId);
            return examinerId;
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

        private async Task<(bool isFinalized, SysFlowpath? approverFlow, SysUserRegistration? approverUser, decimal? approverTotalScore)> CheckIsMarkingFinalizedAsync(ExamRegistration reg, List<ExamNarrativeScore>? preloadedScores = null)
        {
            var approverFlow = await _context.SysFlowpaths
                .FirstOrDefaultAsync(f => f.BatchId == reg.BatchId && f.ExamSetId == reg.QuestionSetId && f.Approver == true);

            if (approverFlow == null)
                return (false, null, null, null);

            var approverUser = await _context.SysUserRegistrations.FindAsync((long)approverFlow.ExaminerId);

            var narrativeQuestions = await GetCandidateNarrativeQuestionsListAsync(reg);
            if (!narrativeQuestions.Any())
                return (false, approverFlow, approverUser, null);

            var scores = preloadedScores ?? await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == reg.ExamineeId)
                .ToListAsync();

            var approverScores = scores
                .Where(s => s.ExaminerId == approverFlow.ExaminerId && narrativeQuestions.Select(q => q.QuestionId).Contains(s.QuestionId))
                .ToList();

            bool isFinalized = approverScores.Count >= narrativeQuestions.Count;
            decimal? approverTotal = approverScores.Any() ? Math.Round(approverScores.Sum(s => s.Marks), 2) : null;

            return (isFinalized, approverFlow, approverUser, approverTotal);
        }

        [HttpGet("candidates")]
        public async Task<IActionResult> GetCandidatesForMarking([FromQuery] int batchId, [FromQuery] int setId)
        {
            var examinerId = GetCurrentExaminerId();

            var examinees = await _context.ExamRegistrations
                .Where(r => r.BatchId == batchId && r.QuestionSetId == setId)
                .Include(r => r.User)
                .ToListAsync();

            var examineeIds = examinees.Select(r => r.ExamineeId).ToList();

            var allScores = await _context.ExamNarrativeScores
                .Where(s => examineeIds.Contains(s.ExamineeId))
                .ToListAsync();

            var approverFlow = await _context.SysFlowpaths
                .FirstOrDefaultAsync(f => f.BatchId == batchId && f.ExamSetId == setId && f.Approver == true);

            var approverUser = approverFlow != null
                ? await _context.SysUserRegistrations.FindAsync((long)approverFlow.ExaminerId)
                : null;

            var scoresByExaminee = allScores.GroupBy(s => s.ExamineeId).ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<NarrativeCandidateDto>();

            foreach (var r in examinees)
            {
                var candidateScores = scoresByExaminee.ContainsKey(r.ExamineeId)
                    ? scoresByExaminee[r.ExamineeId]
                    : new List<ExamNarrativeScore>();

                var isEvaluatedByMe = candidateScores.Any(s => s.ExaminerId == examinerId);
                var distinctExaminers = candidateScores.Select(s => s.ExaminerId).Distinct().Count();
                var myScore = candidateScores.Where(s => s.ExaminerId == examinerId).Sum(s => s.Marks);

                var narrativeQuestions = await GetCandidateNarrativeQuestionsListAsync(r);
                var totalQuestionsCount = narrativeQuestions.Count;

                var approverScores = approverFlow != null
                    ? candidateScores.Where(s => s.ExaminerId == approverFlow.ExaminerId).ToList()
                    : new List<ExamNarrativeScore>();

                bool isFinalized = totalQuestionsCount > 0 && approverScores.Count >= totalQuestionsCount;
                decimal? approverScoreTotal = approverScores.Any() ? Math.Round(approverScores.Sum(s => s.Marks), 2) : null;

                var avgScore = candidateScores.GroupBy(s => s.QuestionId)
                    .Sum(g => g.Average(s => s.Marks));

                result.Add(new NarrativeCandidateDto
                {
                    ExamineeId = r.ExamineeId,
                    LoginId = r.User != null ? r.User.LoginId : "",
                    Name = r.User != null ? r.User.Name : "",
                    Designation = r.User != null ? r.User.Designation : null,
                    DepartmentName = r.User != null ? r.User.DepartmentName : null,
                    BatchId = r.BatchId,
                    QuestionSetId = r.QuestionSetId,
                    CurrentNarrativeScore = isFinalized ? approverScoreTotal : r.WrittenScore,
                    IsEvaluated = candidateScores.Any(),
                    IsEvaluatedByMe = isEvaluatedByMe,
                    ExaminersCount = distinctExaminers,
                    MyNarrativeScore = isEvaluatedByMe ? Math.Round(myScore, 2) : null,
                    AvgNarrativeScore = candidateScores.Any() ? Math.Round(avgScore, 2) : null,
                    IsFinalized = isFinalized,
                    FinalApproverName = isFinalized ? approverUser?.Name : null,
                    FinalApproverScore = approverScoreTotal
                });
            }

            return Ok(result);
        }

        [HttpGet("examinee/{examineeId}/narratives")]
        public async Task<IActionResult> GetCandidateNarrativeQuestions(int examineeId)
        {
            var examinerId = GetCurrentExaminerId();

            var reg = await _context.ExamRegistrations
                .Include(r => r.QuestionSet)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                return NotFound(new { message = "Examinee registration not found." });

            var narrativeQuestions = await GetCandidateNarrativeQuestionsListAsync(reg);

            var candidateAnswers = (await _context.ExamAnswerSheets
                .Where(a => a.ExamineeId == examineeId)
                .ToListAsync())
                .GroupBy(a => a.QuestionId)
                .ToDictionary(g => g.Key, g => g.Last().Answer);

            var candidateScores = await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == examineeId)
                .ToListAsync();

            var (isFinalized, approverFlow, approverUser, approverTotalScore) = await CheckIsMarkingFinalizedAsync(reg, candidateScores);

            var examinerIds = candidateScores.Select(s => s.ExaminerId).Distinct().ToList();
            if (examinerId > 0 && !examinerIds.Contains(examinerId))
                examinerIds.Add(examinerId);

            var examiners = await _context.SysUserRegistrations
                .Where(u => examinerIds.Contains(u.HRRecordId))
                .ToDictionaryAsync(u => u.HRRecordId, u => new { u.Name, u.Designation, u.DepartmentName, u.LoginId });

            var flowpaths = await _context.SysFlowpaths
                .Where(f => f.BatchId == reg.BatchId && f.ExamSetId == reg.QuestionSetId)
                .ToDictionaryAsync(f => (long)f.ExaminerId, f => new { f.Rank, f.Approver });

            bool isCurrentExaminerApprover = approverFlow != null && examinerId == approverFlow.ExaminerId;
            bool canEdit = !isFinalized || isCurrentExaminerApprover;

            var result = narrativeQuestions.Select(q =>
            {
                var questionScores = candidateScores.Where(s => s.QuestionId == q.QuestionId).ToList();

                var myScoreRecord = questionScores.FirstOrDefault(s => s.ExaminerId == examinerId);
                decimal? myMarks = myScoreRecord?.Marks;
                string? myRemarks = myScoreRecord?.Remarks;

                decimal? avgMarks = questionScores.Any()
                    ? Math.Round(questionScores.Average(s => s.Marks), 2)
                    : null;

                var previewList = questionScores.Select(s =>
                {
                    var user = examiners.ContainsKey(s.ExaminerId) ? examiners[s.ExaminerId] : null;
                    var flow = flowpaths.ContainsKey(s.ExaminerId) ? flowpaths[s.ExaminerId] : null;

                    var isApprover = flow?.Approver == true;
                    var rank = flow?.Rank ?? 1;
                    var role = isApprover ? "Final Approver" : (flow != null ? $"Evaluator (Rank {rank})" : "Examiner");

                    var displayDate = s.UpdateDate ?? s.EntryDate;
                    var formattedDate = displayDate.HasValue
                        ? displayDate.Value.ToString("dd-MMM-yyyy hh:mm tt")
                        : null;

                    return new ExaminerScorePreviewDto
                    {
                        ScoreId = s.ScoreId,
                        ExaminerId = s.ExaminerId,
                        ExaminerName = user?.Name ?? $"Examiner {s.ExaminerId}",
                        Designation = user?.Designation ?? "Faculty",
                        DepartmentName = user?.DepartmentName,
                        Role = role,
                        Rank = rank,
                        IsApprover = isApprover,
                        Marks = s.Marks,
                        Remarks = s.Remarks,
                        EntryDate = displayDate,
                        FormattedDate = formattedDate,
                        IsCurrentExaminer = s.ExaminerId == examinerId
                    };
                }).OrderBy(p => p.Rank).ThenBy(p => p.EntryDate).ToList();

                return new CandidateNarrativeQuestionDto
                {
                    QuestionId = q.QuestionId,
                    Question = q.Question,
                    ModelAnswer = q.NarrativeAnswer,
                    MaxMarks = q.Marks,
                    CandidateAnswer = candidateAnswers.ContainsKey(q.QuestionId) ? candidateAnswers[q.QuestionId] : "(No answer submitted)",
                    MyMarks = myMarks,
                    MyRemarks = myRemarks,
                    AvgMarks = avgMarks,
                    ScoredExaminerCount = questionScores.Select(s => s.ExaminerId).Distinct().Count(),
                    ExaminerScores = previewList,
                    AwardedMarks = myMarks ?? avgMarks,
                    Remarks = myRemarks ?? questionScores.LastOrDefault()?.Remarks,
                    IsFinalized = isFinalized,
                    CanEdit = canEdit,
                    FinalApproverName = approverUser?.Name,
                    IsCurrentExaminerApprover = isCurrentExaminerApprover
                };
            }).ToList();

            return Ok(result);
        }

        [HttpPost("score")]
        public async Task<IActionResult> SaveScore([FromBody] SubmitNarrativeScoreDto dto)
        {
            var examinerId = GetCurrentExaminerId();
            if (examinerId <= 0)
                return Unauthorized(new { message = "Examiner authentication required." });

            var reg = await _context.ExamRegistrations
                .Include(r => r.Batch)
                .FirstOrDefaultAsync(r => r.ExamineeId == dto.ExamineeId);

            if (reg == null)
                return NotFound(new { message = "Examinee registration not found." });

            var (isFinalized, approverFlow, approverUser, _) = await CheckIsMarkingFinalizedAsync(reg);

            // Rule: After complete 'Final Approver' marking, no other Examiner can change/submit marking!
            if (isFinalized && examinerId != approverFlow?.ExaminerId)
            {
                return BadRequest(new { 
                    message = $"Marking for this candidate has been finalized by the Final Approver ({approverUser?.Name ?? "Final Approver"}). Further changes or submissions by examiners are locked." 
                });
            }

            var question = await _context.QuestionBanks.FindAsync(dto.QuestionId);
            if (question != null && dto.Marks > question.Marks)
            {
                return BadRequest(new { message = $"Awarded marks ({dto.Marks}) cannot exceed maximum allowed marks ({question.Marks})." });
            }

            var existing = await _context.ExamNarrativeScores
                .FirstOrDefaultAsync(s => s.ExamineeId == dto.ExamineeId && s.QuestionId == dto.QuestionId && s.ExaminerId == examinerId);

            if (existing != null)
            {
                existing.Marks = dto.Marks;
                existing.Remarks = dto.Remarks;
                existing.UpdateDate = DateTime.UtcNow;
            }
            else
            {
                var score = new ExamNarrativeScore
                {
                    ExamineeId = dto.ExamineeId,
                    QuestionId = dto.QuestionId,
                    ExaminerId = examinerId,
                    Marks = dto.Marks,
                    Remarks = dto.Remarks,
                    EntryDate = DateTime.UtcNow
                };
                _context.ExamNarrativeScores.Add(score);
            }

            await _context.SaveChangesAsync();

            var totalWritten = await RecalculateExamineeWrittenScoreAsync(dto.ExamineeId, examinerId);

            var examiner = await _context.SysUserRegistrations.FindAsync(examinerId);
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                examinerId,
                examiner?.LoginId ?? examinerId.ToString(),
                examiner?.Name ?? "Examiner",
                "Admin",
                "GRADING",
                "GRADE_NARRATIVE",
                $"Examiner '{examiner?.Name}' scored Question #{dto.QuestionId} for Examinee #{dto.ExamineeId}: {dto.Marks} marks awarded.",
                ip);

            return Ok(new { 
                message = "Score saved and candidate total recalculated successfully.", 
                totalWrittenScore = totalWritten 
            });
        }

        [HttpPost("score-all")]
        public async Task<IActionResult> SaveAllScores([FromBody] SubmitAllNarrativeScoresDto dto)
        {
            var examinerId = GetCurrentExaminerId();
            if (examinerId <= 0)
                return Unauthorized(new { message = "Examiner authentication required." });

            var reg = await _context.ExamRegistrations
                .Include(r => r.Batch)
                .FirstOrDefaultAsync(r => r.ExamineeId == dto.ExamineeId);

            if (reg == null)
                return NotFound(new { message = "Examinee registration not found." });

            var (isFinalized, approverFlow, approverUser, _) = await CheckIsMarkingFinalizedAsync(reg);

            // Rule: After complete 'Final Approver' marking, no other Examiner can change/submit marking!
            if (isFinalized && examinerId != approverFlow?.ExaminerId)
            {
                return BadRequest(new { 
                    message = $"Marking for this candidate has been finalized by the Final Approver ({approverUser?.Name ?? "Final Approver"}). Further changes or submissions by examiners are locked." 
                });
            }

            var questionIds = dto.Scores.Select(s => s.QuestionId).ToList();
            var questions = await _context.QuestionBanks
                .Where(q => questionIds.Contains(q.QuestionId))
                .ToDictionaryAsync(q => q.QuestionId, q => q.Marks);

            foreach (var item in dto.Scores)
            {
                if (questions.ContainsKey(item.QuestionId) && item.Marks > questions[item.QuestionId])
                {
                    return BadRequest(new { message = $"Marks for Question #{item.QuestionId} ({item.Marks}) cannot exceed maximum allowed ({questions[item.QuestionId]})." });
                }
            }

            var existingScores = await _context.ExamNarrativeScores
                .Where(s => s.ExamineeId == dto.ExamineeId && s.ExaminerId == examinerId)
                .ToListAsync();

            foreach (var item in dto.Scores)
            {
                var existing = existingScores.FirstOrDefault(s => s.QuestionId == item.QuestionId);
                if (existing != null)
                {
                    existing.Marks = item.Marks;
                    existing.Remarks = item.Remarks;
                    existing.UpdateDate = DateTime.UtcNow;
                }
                else
                {
                    _context.ExamNarrativeScores.Add(new ExamNarrativeScore
                    {
                        ExamineeId = dto.ExamineeId,
                        QuestionId = item.QuestionId,
                        ExaminerId = examinerId,
                        Marks = item.Marks,
                        Remarks = item.Remarks,
                        EntryDate = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            var totalWritten = await RecalculateExamineeWrittenScoreAsync(dto.ExamineeId, examinerId);

            var examiner = await _context.SysUserRegistrations.FindAsync(examinerId);
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                examinerId,
                examiner?.LoginId ?? examinerId.ToString(),
                examiner?.Name ?? "Examiner",
                "Admin",
                "GRADING",
                "GRADE_NARRATIVE_ALL",
                $"Examiner '{examiner?.Name}' saved all {dto.Scores.Count} narrative scores for Examinee #{dto.ExamineeId}.",
                ip);

            return Ok(new { message = $"All {dto.Scores.Count} scores saved successfully!", totalWrittenScore = totalWritten });
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

            var (isFinalized, approverFlow, _, approverTotal) = await CheckIsMarkingFinalizedAsync(reg, allScores);

            decimal totalWritten;

            if (approverFlow != null)
            {
                var approverScores = allScores
                    .Where(s => s.ExaminerId == approverFlow.ExaminerId)
                    .ToList();

                var narrativeQuestions = await GetCandidateNarrativeQuestionsListAsync(reg);

                // If Final Approver has completed all questions: consider the mark as FINAL mark!
                if (narrativeQuestions.Any() && approverScores.Count >= narrativeQuestions.Count)
                {
                    totalWritten = approverScores.Sum(s => s.Marks);
                }
                else if (approverScores.Any())
                {
                    // If Final Approver has scored some questions: use Final Approver's marks for scored questions, average for remaining
                    totalWritten = narrativeQuestions.Sum(q => {
                        var appScore = approverScores.FirstOrDefault(s => s.QuestionId == q.QuestionId);
                        if (appScore != null) return appScore.Marks;
                        var otherScores = allScores.Where(s => s.QuestionId == q.QuestionId).ToList();
                        return otherScores.Any() ? otherScores.Average(s => s.Marks) : 0;
                    });
                }
                else
                {
                    // Final Approver hasn't scored yet: average across evaluators
                    totalWritten = allScores
                        .GroupBy(s => s.QuestionId)
                        .Sum(g => g.Average(s => s.Marks));
                }
            }
            else
            {
                // No final approver configured: average across evaluators
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
    }
}
