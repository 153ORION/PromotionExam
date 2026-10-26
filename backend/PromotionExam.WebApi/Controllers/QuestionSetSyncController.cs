using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.Questions;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;
using PromotionExam.Infrastructure.Services;

namespace PromotionExam.WebApi.Controllers
{
    // Question Bank > Question Sets > Sync: copies questions from the question bank (Bulk_Questions_Excel,
    // filled by Excel uploads and manual entry) into a set's Question_Bank.
    //
    // A bank question matches a set when its Location, Department, Grade and Concentration ids equal the
    // set's; a set field left empty matches any value. It is already in the set when the set has a
    // question with the same text. Only valid questions are offered: rows with errors or a disputed
    // Type/Part must be fixed first. Type goes to Question_Bank.TypeId (MCQ 1, Descriptive 2) and
    // Part to Question_Bank.CategoryId.
    [Authorize(Policy = "AdminOnly")]
    [ApiController]
    [Route("api/questions/sets")]
    public class QuestionSetSyncController : ControllerBase
    {
        private const int TypeIdMcq = 1;
        private const int TypeIdNarrative = 2;

        private readonly ApplicationDbContext _context;
        private readonly IUserActivityService _activityService;

        public QuestionSetSyncController(ApplicationDbContext context, IUserActivityService activityService)
        {
            _context = context;
            _activityService = activityService;
        }

        // Number of questions waiting to be synced into each set, keyed by SetId.
        [HttpGet("unsynced-counts")]
        public async Task<IActionResult> GetUnsyncedCounts()
        {
            var sets = await _context.QuestionSets.AsNoTracking().ToListAsync();
            var counts = new Dictionary<int, int>();
            foreach (var set in sets)
                counts[set.SetId] = await Unsynced(set).CountAsync();
            return Ok(counts);
        }

        [HttpGet("{setId:int}/unsynced")]
        public async Task<IActionResult> GetUnsynced(int setId)
        {
            var set = await _context.QuestionSets.AsNoTracking().FirstOrDefaultAsync(s => s.SetId == setId);
            if (set == null)
                return NotFound(new { message = "Question Set not found." });

            var questions = await Unsynced(set)
                .OrderBy(q => q.QuestionPart).ThenBy(q => q.QuestionType).ThenBy(q => q.BulkQuestionId)
                .ToListAsync();

            return Ok(new SetSyncCandidatesDto
            {
                SetId = set.SetId,
                SetName = set.SetName,
                NeedsFixingCount = await NotInSet(Matching(set).Where(q => q.HasError || q.IsTypeDisputed || q.IsPartDisputed), set.SetId).CountAsync(),
                Questions = questions.Select(QuestionBankUploadController.ToRowDto).ToList()
            });
        }

        // Adds the selected bank questions to the set. Each one is checked again, since it may have been
        // changed, fixed or added to the set since the list was loaded; those that no longer qualify are skipped.
        [HttpPost("{setId:int}/sync")]
        public async Task<IActionResult> Sync(int setId, [FromBody] SetSyncRequestDto dto)
        {
            if (dto.BulkQuestionIds == null || dto.BulkQuestionIds.Count == 0)
                return BadRequest(new { message = "Select at least one question." });
            if (dto.McqMarks <= 0 || dto.DescriptiveMarks <= 0)
                return BadRequest(new { message = "Marks must be greater than 0." });

            var set = await _context.QuestionSets.AsNoTracking().FirstOrDefaultAsync(s => s.SetId == setId);
            if (set == null)
                return NotFound(new { message = "Question Set not found." });

            // In chunks: each id becomes one SQL parameter and SQL Server allows 2100.
            var ids = dto.BulkQuestionIds.Distinct().ToList();
            var candidates = new List<BulkQuestionExcel>();
            foreach (var chunk in ids.Chunk(1000))
                candidates.AddRange(await Unsynced(set).Where(q => chunk.Contains(q.BulkQuestionId)).ToListAsync());

            var now = DateTime.Now;
            var added = new List<QuestionBank>();
            // The same question selected twice (e.g. kept as a duplicate in two uploads) is added once.
            // Trailing spaces are ignored, as in the SQL text comparison.
            var texts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var b in candidates.OrderBy(q => q.QuestionPart).ThenBy(q => q.QuestionType).ThenBy(q => q.BulkQuestionId))
            {
                if (!texts.Add(b.Question.TrimEnd())) continue;
                var question = ToSetQuestion(b, set.SetId, dto.McqMarks, dto.DescriptiveMarks, now);
                if (question != null) added.Add(question);
            }

            int skipped = ids.Count - added.Count;
            int mcq = added.Count(q => q.TypeId == TypeIdMcq);
            if (added.Count > 0)
            {
                _context.QuestionBanks.AddRange(added);
                await _context.SaveChangesAsync();

                await LogAsync("QUESTION_SET_SYNC",
                    $"Synced {added.Count} question(s) from the question bank into Question Set #{set.SetId} ({set.SetName}): {mcq} MCQ, {added.Count - mcq} descriptive, {skipped} skipped.",
                    JsonSerializer.Serialize(new
                    {
                        set.SetId, set.SetName, synced = added.Count, mcq, descriptive = added.Count - mcq, skipped,
                        dto.McqMarks, dto.DescriptiveMarks, questionIds = added.Select(q => q.QuestionId).ToList()
                    }));
            }

            var message = added.Count == 0
                ? "No questions were added."
                : $"{added.Count} question(s) added to '{set.SetName}' ({mcq} MCQ, {added.Count - mcq} descriptive).";
            if (skipped > 0)
                message += $" {skipped} skipped: already in the set, no longer matching it, or repeating another selected question.";

            return Ok(new SetSyncResultDto { Synced = added.Count, Skipped = skipped, Message = message });
        }

        // Bank questions with the set's Location, Department, Grade and Concentration ids (empty = any).
        private IQueryable<BulkQuestionExcel> Matching(QuestionSet set)
        {
            var query = _context.BulkQuestionsExcel.AsNoTracking();
            if (set.LocationId.HasValue) query = query.Where(q => q.LocationId == set.LocationId);
            if (set.DepartmentId.HasValue) query = query.Where(q => q.DepartmentId == set.DepartmentId);
            if (set.GradeId.HasValue) query = query.Where(q => q.GradeId == set.GradeId);
            if (set.ConcentrationId.HasValue) query = query.Where(q => q.ConcentrationId == set.ConcentrationId);
            return query;
        }

        // Question text equality in SQL (case-insensitive collation).
        private IQueryable<BulkQuestionExcel> NotInSet(IQueryable<BulkQuestionExcel> query, int setId) =>
            query.Where(b => !_context.QuestionBanks.Any(q => q.SetId == setId && q.Question == b.Question));

        private IQueryable<BulkQuestionExcel> Unsynced(QuestionSet set) =>
            NotInSet(Matching(set).Where(q => !q.HasError && !q.IsTypeDisputed && !q.IsPartDisputed), set.SetId);

        // Type MCQ/Descriptive becomes TypeId 1/2 and Part 1/2/3 becomes CategoryId 1/2/3.
        // MCQ options become Question_Bank_Answer rows; empty options are left out and the rest are
        // numbered 1, 2, 3… in order. Returns null for an MCQ whose right answer matches no option.
        private static QuestionBank? ToSetQuestion(BulkQuestionExcel b, int setId, decimal mcqMarks, decimal descriptiveMarks, DateTime now)
        {
            bool isMcq = b.QuestionType == BulkQuestionExcelParser.TypeMcq;
            var question = new QuestionBank
            {
                SetId = setId,
                TypeId = isMcq ? TypeIdMcq : TypeIdNarrative,
                CategoryId = int.TryParse(b.QuestionPart, out var part) ? part : null,
                Question = b.Question,
                NarrativeAnswer = isMcq ? null : b.RightAnswer,
                Marks = isMcq ? mcqMarks : descriptiveMarks,
                IsActive = true,
                EntryDate = now
            };
            if (!isMcq) return question;

            var options = new[] { b.Option1, b.Option2, b.Option3, b.Option4 };
            var rightNo = RightOptionNo(b.RightAnswer, options);
            if (rightNo == null) return null;

            int serial = 1;
            for (int i = 0; i < options.Length; i++)
            {
                if (string.IsNullOrEmpty(options[i])) continue;
                question.Answers.Add(new QuestionBankAnswer
                {
                    AnswerDetails = options[i]!,
                    AnswerSerial = serial++,
                    AnswerIsRight = i + 1 == rightNo ? 1 : 0,
                    EntryDate = now
                });
            }
            return question;
        }

        // A valid MCQ stores its answer as the option number (1-4) or as the text of an option.
        private static int? RightOptionNo(string? answer, string?[] options)
        {
            if (int.TryParse(answer, out var no))
                return no >= 1 && no <= options.Length && !string.IsNullOrEmpty(options[no - 1]) ? no : null;
            var index = Array.FindIndex(options, o => !string.IsNullOrEmpty(o) && string.Equals(o, answer, StringComparison.OrdinalIgnoreCase));
            return index >= 0 ? index + 1 : null;
        }

        private async Task LogAsync(string action, string description, string detailsJson)
        {
            long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId);
            var actor = userId > 0 ? await _context.SysUserRegistrations.FindAsync(userId) : null;
            await _activityService.LogAsync(
                userId > 0 ? userId : null,
                actor?.LoginId ?? userId.ToString(),
                actor?.Name ?? "User",
                User.IsInRole("SuperAdmin") ? "SuperAdmin" : "Admin",
                "QUESTION",
                action,
                description,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                detailsJson);
        }
    }
}
