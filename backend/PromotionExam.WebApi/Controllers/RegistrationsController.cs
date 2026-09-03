using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.DTOs.Exam;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class RegistrationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RegistrationsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetRegistrations([FromQuery] int? batchId, [FromQuery] int? questionSetId)
        {
            var query = _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .AsQueryable();

            if (batchId.HasValue && batchId.Value > 0)
                query = query.Where(r => r.BatchId == batchId.Value);

            if (questionSetId.HasValue && questionSetId.Value > 0)
                query = query.Where(r => r.QuestionSetId == questionSetId.Value);

            var list = await query
                .OrderByDescending(r => r.ExamineeId)
                .Select(r => new ExamRegistrationDto
                {
                    ExamineeId = r.ExamineeId,
                    HRRecordId = r.HRRecordId,
                    LoginId = r.User != null ? r.User.LoginId : "",
                    ExamineeName = r.User != null ? r.User.Name : "",
                    Designation = r.User != null ? r.User.Designation : null,
                    DepartmentName = r.User != null ? r.User.DepartmentName : null,
                    CompanyName = r.User != null ? r.User.CompanyName : null,
                    LocationName = r.User != null ? r.User.LocationName : null,
                    GradeName = r.User != null ? r.User.GradeName : null,
                    BatchId = r.BatchId,
                    BatchName = r.Batch != null ? r.Batch.ExamName : null,
                    QuestionSetId = r.QuestionSetId,
                    SetName = r.QuestionSet != null ? r.QuestionSet.SetName : null,
                    ExamGradeId = r.ExamGradeId,
                    MCQScore = r.MCQScore,
                    WrittenScore = r.WrittenScore,
                    TotalScore = r.TotalScore,
                    ExamStart = r.ExamStart,
                    ExamEnd = r.ExamEnd,
                    IsAttand = r.IsAttand,
                    IsExamEnd = r.IsExamEnd,
                    IsTimeExpire = r.IsTimeExpire,
                    IsActive = r.IsActive
                })
                .ToListAsync();

            return Ok(list);
        }

        [HttpGet("search-employee")]
        public async Task<IActionResult> SearchEmployee([FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest(new { message = "Query search parameter is required." });

            var q = query.Trim();
            var user = await _context.SysUserRegistrations
                .Where(u => u.LoginId == q || (u.Email != null && u.Email == q) || u.Name.Contains(q))
                .Select(u => new
                {
                    u.HRRecordId,
                    u.LoginId,
                    u.Name,
                    u.Designation,
                    u.GradeName,
                    u.CompanyName,
                    u.DepartmentName,
                    u.LocationName,
                    u.Email,
                    u.Mobile,
                    u.IsActive
                })
                .FirstOrDefaultAsync();

            if (user == null)
                return NotFound(new { message = "No employee found with this Login ID or Name." });

            return Ok(user);
        }

        [HttpPost]
        public async Task<IActionResult> Register([FromBody] RegistrationCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LoginId))
                return BadRequest(new { message = "Login ID is required." });

            var user = await _context.SysUserRegistrations
                .FirstOrDefaultAsync(u => u.LoginId == dto.LoginId.Trim());

            if (user == null)
                return NotFound(new { message = "Employee not found." });

            var exists = await _context.ExamRegistrations
                .AnyAsync(r => r.HRRecordId == user.HRRecordId && r.BatchId == dto.BatchId);

            if (exists)
                return BadRequest(new { message = "This employee is already registered in this exam batch." });

            var registration = new ExamRegistration
            {
                HRRecordId = user.HRRecordId,
                BatchId = dto.BatchId,
                QuestionSetId = dto.QuestionSetId,
                ExamGradeId = dto.PromotedGradeId,
                IsAttand = false,
                IsExamEnd = false,
                IsTimeExpire = false,
                IsActive = true,
                EntryDate = DateTime.UtcNow
            };

            _context.ExamRegistrations.Add(registration);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Employee registered for exam batch successfully.", examineeId = registration.ExamineeId });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Unregister(int id)
        {
            var reg = await _context.ExamRegistrations.FindAsync(id);
            if (reg == null)
                return NotFound(new { message = "Registration not found." });

            _context.ExamRegistrations.Remove(reg);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Examinee unregistered successfully." });
        }
    }
}
