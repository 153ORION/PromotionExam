using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.DTOs.Dashboard;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var totalExaminees = await _context.ExamRegistrations.CountAsync(r => r.IsActive == true);   // Item 13: count only active registrations
            // Examinees registered in currently ACTIVE exam batches only
            var totalCurrentExaminees = await _context.ExamRegistrations
                .CountAsync(r => r.IsActive == true && _context.ExamBatches.Any(b => b.BatchId == r.BatchId && b.IsActive == true));
            var totalExaminers = await _context.SysFlowpaths.Select(f => f.ExaminerId).Distinct().CountAsync();
            var totalBatches = await _context.ExamBatches.CountAsync(b => b.IsActive == true);
            var totalQuestionSets = await _context.QuestionSets.CountAsync(s => s.IsActive == true);
            var totalMCQ = await _context.QuestionBanks.CountAsync(q => q.TypeId == 1);
            var totalWritten = await _context.QuestionBanks.CountAsync(q => q.TypeId == 2);
            var totalCompleted = await _context.ExamRegistrations.CountAsync(r => r.IsExamEnd == true && r.IsActive == true);

            var stats = new DashboardStatsDto
            {
                TotalExaminees = totalExaminees,
                TotalCurrentExaminees = totalCurrentExaminees,
                TotalExaminers = totalExaminers,
                TotalBatches = totalBatches,
                TotalQuestionSets = totalQuestionSets,
                TotalMCQQuestions = totalMCQ,
                TotalWrittenQuestions = totalWritten,
                TotalCompletedExams = totalCompleted
            };

            return Ok(stats);
        }
    }
}
