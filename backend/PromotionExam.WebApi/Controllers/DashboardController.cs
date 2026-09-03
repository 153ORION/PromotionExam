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
            var totalExaminees = await _context.ExamRegistrations.CountAsync();
            var totalExaminers = await _context.SysFlowpaths.Select(f => f.ExaminerId).Distinct().CountAsync();
            var totalBatches = await _context.ExamBatches.CountAsync();
            var totalQuestionSets = await _context.QuestionSets.CountAsync();
            var totalMCQ = await _context.QuestionBanks.CountAsync(q => q.TypeId == 1);
            var totalWritten = await _context.QuestionBanks.CountAsync(q => q.TypeId == 2);
            var totalCompleted = await _context.ExamRegistrations.CountAsync(r => r.IsExamEnd == true);

            var stats = new DashboardStatsDto
            {
                TotalExaminees = totalExaminees,
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
