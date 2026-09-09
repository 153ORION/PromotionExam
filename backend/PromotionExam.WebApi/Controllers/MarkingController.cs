using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Ai;
using PromotionExam.Application.Common.Interfaces;
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
        private readonly IUserActivityService _activityService;
        private readonly IAiMarkingService _aiMarkingService;

        // Stored AI JSON (Strengths/Missing/Incorrect/CriterionBreakdown) is persisted with camelCase
        // naming by AiMarkingService; parsing must be case-insensitive to bind property names correctly.
        private static readonly JsonSerializerOptions AiJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public MarkingController(
            ApplicationDbContext context,
            IUserActivityService activityService,
            IAiMarkingService aiMarkingService)
        {
            _context = context;
            _activityService = activityService;
            _aiMarkingService = aiMarkingService;
        }

        private long GetCurrentExaminerId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            long.TryParse(userIdClaim, out var examinerId);
            return examinerId;
        }

        private async Task<List<QuestionBank>> GetCandidateNarrativeQuestionsListAsync(ExamRegistration reg)
        {
            // 1. Primary source: questions assigned in Examination Question Sheet
            var assignedQuestions = await (from s in _context.ExamQuestionSheets
                                           join q in _context.QuestionBanks on s.QuestionId equals q.QuestionId
                                           where s.ExamineeId == reg.ExamineeId && q.TypeId == 2
                                           orderby s.QuestionSeq, s.QuestionId
                                           select q)
                                           .ToListAsync();

            if (assignedQuestions.Any())
            {
                return assignedQuestions
                    .GroupBy(q => q.QuestionId)
                    .Select(g => g.First())
                    .ToList();
            }

            // 2. Fallback: if Examination Question Sheet has no records for this examinee, check if they answered narrative questions in Exam_Answer_Sheet
            var answeredQuestions = await (from a in _context.ExamAnswerSheets
                                           join q in _context.QuestionBanks on a.QuestionId equals q.QuestionId
                                           where a.ExamineeId == reg.ExamineeId && q.TypeId == 2
                                           orderby a.EAS_Id
                                           select q)
                                           .ToListAsync();

            if (answeredQuestions.Any())
            {
                return answeredQuestions
                    .GroupBy(q => q.QuestionId)
                    .Select(g => g.First())
                    .ToList();
            }

            // 3. Do not dump the entire question set: an examinee without assigned or answered questions has 0 questions to mark.
            return new List<QuestionBank>();
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
                .Where(r => r.BatchId == batchId && r.QuestionSetId == setId && r.IsActive == true)   // Item 13: only active registrations
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
                    FinalApproverScore = approverScoreTotal,
                    TotalQuestionsCount = totalQuestionsCount
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

            var activeRubrics = await _context.AiRubricMasters
                .Where(r => narrativeQuestions.Select(q => q.QuestionId).Contains(r.QuestionId) && r.IsActive)
                .GroupBy(r => r.QuestionId)
                .Select(g => g.OrderByDescending(x => x.VersionNo).First())
                .ToDictionaryAsync(r => r.QuestionId, r => r);

            var rubricIds = activeRubrics.Values.Select(r => r.RubricMasterId).ToList();
            var aiEvaluations = rubricIds.Any()
                ? await _context.ExamNarrativeAiEvaluations
                    .Where(e => e.ExamineeId == examineeId && rubricIds.Contains(e.RubricMasterId))
                    .ToListAsync()
                : new List<ExamNarrativeAiEvaluation>();
            var aiEvaluationMap = aiEvaluations.ToDictionary(e => (e.QuestionId, e.RubricMasterId), e => e);

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
                    IsCurrentExaminerApprover = isCurrentExaminerApprover,
                    AiRubricStatus = GetAiRubricStatus(q, activeRubrics),
                    AiRubricVersionNo = activeRubrics.ContainsKey(q.QuestionId) ? activeRubrics[q.QuestionId].VersionNo : null,
                    AiRubricNeedsRegeneration = IsAiRubricOutdated(q, activeRubrics),
                    AiEvaluation = GetAiEvaluationDto(q.QuestionId, activeRubrics, aiEvaluationMap)
                };
            }).ToList();

            return Ok(result);
        }

        [HttpPost("ai-evaluate")]
        public async Task<IActionResult> EvaluateNarrativeWithAi([FromBody] EvaluateAiNarrativeRequestDto dto)
        {
            var examinerId = GetCurrentExaminerId();
            if (examinerId <= 0)
                return Unauthorized(new { message = "Examiner authentication required." });

            try
            {
                var evaluation = await _aiMarkingService.EvaluateAnswerAsync(dto.ExamineeId, dto.QuestionId, dto.ForceReevaluate, examinerId);

                var examiner = await _context.SysUserRegistrations.FindAsync(examinerId);
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _activityService.LogAsync(
                    examinerId,
                    examiner?.LoginId ?? examinerId.ToString(),
                    examiner?.Name ?? "Examiner",
                    "Admin",
                    "AI_MARKING",
                    dto.ForceReevaluate ? "AI_MARK_REEVALUATE" : "AI_MARK_EVALUATE",
                    $"AI evaluated Question #{dto.QuestionId} for Examinee #{dto.ExamineeId}: {evaluation.AwardedMarks}/{evaluation.MaxMarks}.",
                    ip);

                return Ok(evaluation);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("examinee/{examineeId}/auto-mark")]
        public async Task<IActionResult> AutoMarkExaminee(int examineeId, [FromBody] AutoMarkExamineeRequestDto? dto)
        {
            var examinerId = GetCurrentExaminerId();
            if (examinerId <= 0)
                return Unauthorized(new { message = "Examiner authentication required." });

            var reg = await _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

            if (reg == null)
                return NotFound(new { message = "Examinee registration not found." });

            var (isFinalized, approverFlow, approverUser, _) = await CheckIsMarkingFinalizedAsync(reg);
            bool autoApply = dto?.AutoApplyScores ?? true;

            // Resolve the AI Examiner identity: scores applied by auto-marking are recorded
            // under the dedicated AI Examiner account (employee 0000000) so that marks are
            // attributed to the AI Examiner rather than the human examiner who triggered it.
            var aiExaminer = await _context.SysUserRegistrations
                .FirstOrDefaultAsync(u => u.LoginId == "0000000" && u.IsActive == true);
            var scoringExaminerId = aiExaminer != null ? aiExaminer.HRRecordId : examinerId;
            var scoringExaminerName = aiExaminer?.Name ?? "AI Examiner";

            // If finalized and the scoring examiner (AI Examiner) is not the Final Approver, do not allow applying scores
            if (isFinalized && scoringExaminerId != (approverFlow?.ExaminerId ?? 0) && autoApply)
            {
                return BadRequest(new {
                    message = $"Marking for this candidate has been finalized by the Final Approver ({approverUser?.Name ?? "Final Approver"}). Scores cannot be overwritten."
                });
            }

            try
            {
                var forceReevaluate = dto?.ForceReevaluate ?? false;
                var result = await _aiMarkingService.AutoMarkExamineeAsync(examineeId, forceReevaluate, autoApply, scoringExaminerId);

                var examiner = await _context.SysUserRegistrations.FindAsync(examinerId);
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _activityService.LogAsync(
                    examinerId,
                    examiner?.LoginId ?? examinerId.ToString(),
                    examiner?.Name ?? "Examiner",
                    "Admin",
                    "AI_MARKING",
                    "AI_AUTO_MARK_EXAMINEE",
                    $"AI auto-marked Examinee #{examineeId} ({reg.User?.Name ?? "Candidate"}) via AI Examiner '{scoringExaminerName}': {result.EvaluatedCount}/{result.TotalQuestions} questions evaluated, awarded {result.TotalAwardedMarks:F2}/{result.TotalMaxMarks:F2} marks (Scores Applied: {result.ScoresApplied}).",
                    ip);

                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
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
                existing.UpdateDate = DateTime.Now;
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
                    EntryDate = DateTime.Now
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
                    existing.UpdateDate = DateTime.Now;
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
                        EntryDate = DateTime.Now
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
            reg.LastUpdateTime = DateTime.Now;
            await _context.SaveChangesAsync();

            return totalWritten;
        }

        private static string GetAiRubricStatus(QuestionBank question, Dictionary<int, AiRubricMaster> activeRubrics)
        {
            if (!activeRubrics.TryGetValue(question.QuestionId, out var rubric))
                return "NotGenerated";

            var fingerprint = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);
            return string.Equals(rubric.RubricHash, fingerprint, StringComparison.OrdinalIgnoreCase) ? "Ready" : "Outdated";
        }

        private static bool IsAiRubricOutdated(QuestionBank question, Dictionary<int, AiRubricMaster> activeRubrics)
        {
            if (!activeRubrics.TryGetValue(question.QuestionId, out var rubric))
                return false;

            var fingerprint = AiRubricFingerprint.Create(question.Question, question.NarrativeAnswer, question.Marks);
            return !string.Equals(rubric.RubricHash, fingerprint, StringComparison.OrdinalIgnoreCase);
        }

        private static AiNarrativeEvaluationDto? GetAiEvaluationDto(
            int questionId,
            Dictionary<int, AiRubricMaster> activeRubrics,
            Dictionary<(int QuestionId, int RubricMasterId), ExamNarrativeAiEvaluation> aiEvaluationMap)
        {
            if (!activeRubrics.TryGetValue(questionId, out var rubric))
                return null;

            if (!aiEvaluationMap.TryGetValue((questionId, rubric.RubricMasterId), out var evaluation))
                return null;

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
                Strengths = DeserializeStringList(evaluation.StrengthsJson),
                MissingPoints = DeserializeStringList(evaluation.MissingPointsJson),
                IncorrectPoints = DeserializeStringList(evaluation.IncorrectPointsJson),
                CriterionBreakdown = DeserializeCriterionBreakdown(evaluation.CriterionBreakdownJson),
                ValidationStatus = evaluation.ValidationStatus,
                ValidationNotes = evaluation.ValidationNotes,
                ReviewRecommended = evaluation.ReviewRecommended,
                SourceModel = evaluation.SourceModel,
                PromptVersion = evaluation.PromptVersion,
                EntryDate = evaluation.UpdateDate ?? evaluation.EntryDate,
                IsCached = true
            };
        }

        private static List<string> DeserializeStringList(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<string>();

            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private static List<AiEvaluationCriterionDto> DeserializeCriterionBreakdown(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new List<AiEvaluationCriterionDto>();

            try
            {
                return JsonSerializer.Deserialize<List<AiEvaluationCriterionDto>>(json, AiJsonOptions) ?? new List<AiEvaluationCriterionDto>();
            }
            catch
            {
                return new List<AiEvaluationCriterionDto>();
            }
        }
    }
}
