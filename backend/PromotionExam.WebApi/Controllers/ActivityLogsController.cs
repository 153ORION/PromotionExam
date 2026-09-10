using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.DTOs.Activity;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize(Policy = "AdminOnly")]
    [ApiController]
    [Route("api/system/activitylogs")]
    public class ActivityLogsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ActivityLogsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetActivityLogs(
            [FromQuery] string? search,
            [FromQuery] string? role,
            [FromQuery] string? category,
            [FromQuery] int limit = 100)
        {
            var query = _context.SysUserActivityLogs.AsQueryable();

            if (!string.IsNullOrWhiteSpace(role) && role != "ALL")
            {
                query = query.Where(a => a.Role == role);
            }

            if (!string.IsNullOrWhiteSpace(category) && category != "ALL")
            {
                query = query.Where(a => a.ActivityCategory == category);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(a =>
                    a.UserName.ToLower().Contains(s) ||
                    a.LoginId.ToLower().Contains(s) ||
                    a.Description.ToLower().Contains(s) ||
                    a.ActionName.ToLower().Contains(s));
            }

            var logs = await query
                .OrderByDescending(a => a.Timestamp)
                .Take(limit)
                .Select(a => new UserActivityDto
                {
                    ActivityId = a.ActivityId,
                    HRRecordId = a.HRRecordId,
                    LoginId = a.LoginId,
                    UserName = a.UserName,
                    Role = a.Role,
                    ActivityCategory = a.ActivityCategory,
                    ActionName = a.ActionName,
                    Description = a.Description,
                    IpAddress = a.IpAddress,
                    Timestamp = a.Timestamp,
                    DetailsJson = a.DetailsJson
                })
                .ToListAsync();

            return Ok(logs);
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetActivityOverview()
        {
            var total = await _context.SysUserActivityLogs.CountAsync();
            var logins = await _context.SysUserActivityLogs.CountAsync(a => a.ActionName == "LOGIN");
            var exams = await _context.SysUserActivityLogs.CountAsync(a => a.ActivityCategory == "EXAM");
            var gradings = await _context.SysUserActivityLogs.CountAsync(a => a.ActivityCategory == "GRADING");
            var adminActions = await _context.SysUserActivityLogs.CountAsync(a => a.ActivityCategory == "ADMIN" || a.ActivityCategory == "HR");

            return Ok(new ActivityOverviewDto
            {
                TotalActivities = total,
                LoginsCount = logins,
                ExamsTakenCount = exams,
                GradingCount = gradings,
                AdminActionsCount = adminActions
            });
        }
    }
}
