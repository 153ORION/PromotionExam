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

        // GET /api/registrations — returns only IsActive=true records
        [HttpGet]
        public async Task<IActionResult> GetRegistrations([FromQuery] int? batchId, [FromQuery] int? questionSetId)
        {
            var query = _context.ExamRegistrations
                .Include(r => r.User)
                .Include(r => r.Batch)
                .Include(r => r.QuestionSet)
                .Where(r => r.IsActive == true)   // Item 13: only show active registrations
                .AsQueryable();

            if (batchId.HasValue && batchId.Value > 0)
                query = query.Where(r => r.BatchId == batchId.Value);

            if (questionSetId.HasValue && questionSetId.Value > 0)
                query = query.Where(r => r.QuestionSetId == questionSetId.Value);

            var lookups = await _context.SysLookups.ToDictionaryAsync(l => l.LookupId, l => l.LookupText);

            var rawList = await query
                .OrderByDescending(r => r.ExamineeId)
                .Select(r => new
                {
                    r.ExamineeId,
                    r.HRRecordId,
                    LoginId = r.User != null ? r.User.LoginId : "",
                    ExamineeName = r.User != null ? r.User.Name : "",
                    Designation = r.User != null ? r.User.Designation : null,
                    DepartmentName = r.User != null ? r.User.DepartmentName : null,
                    CompanyName = r.User != null ? r.User.CompanyName : null,
                    LocationName = r.User != null ? r.User.LocationName : null,
                    GradeName = r.User != null ? r.User.GradeName : null,
                    r.BatchId,
                    BatchName = r.Batch != null ? r.Batch.ExamName : null,
                    r.QuestionSetId,
                    SetName = r.QuestionSet != null ? r.QuestionSet.SetName : null,
                    r.ExamGradeId,
                    r.MCQScore,
                    r.WrittenScore,
                    r.TotalScore,
                    r.ExamStart,
                    r.ExamEnd,
                    r.IsAttand,
                    r.IsExamEnd,
                    r.IsTimeExpire,
                    r.IsActive
                })
                .ToListAsync();

            var list = rawList.Select(r => new ExamRegistrationDto
            {
                ExamineeId = r.ExamineeId,
                HRRecordId = r.HRRecordId,
                LoginId = r.LoginId,
                ExamineeName = r.ExamineeName,
                Designation = r.Designation,
                DepartmentName = r.DepartmentName,
                CompanyName = r.CompanyName,
                LocationName = r.LocationName,
                GradeName = r.GradeName,
                BatchId = r.BatchId,
                BatchName = r.BatchName,
                QuestionSetId = r.QuestionSetId,
                SetName = r.SetName,
                ExamGradeId = r.ExamGradeId,
                ExamGradeName = r.ExamGradeId.HasValue && lookups.ContainsKey(r.ExamGradeId.Value) ? lookups[r.ExamGradeId.Value] : null,
                MCQScore = r.MCQScore,
                WrittenScore = r.WrittenScore,
                TotalScore = r.TotalScore,
                ExamStart = r.ExamStart,
                ExamEnd = r.ExamEnd,
                IsAttand = r.IsAttand,
                IsExamEnd = r.IsExamEnd,
                IsTimeExpire = r.IsTimeExpire,
                IsActive = r.IsActive
            }).ToList();

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

        // POST /api/registrations — register an employee; blocks only if an ACTIVE registration exists
        [HttpPost]
        public async Task<IActionResult> Register([FromBody] RegistrationCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LoginId))
                return BadRequest(new { message = "Login ID is required." });

            var user = await _context.SysUserRegistrations
                .FirstOrDefaultAsync(u => u.LoginId == dto.LoginId.Trim());

            if (user == null)
                return NotFound(new { message = "Employee not found." });

            var batch = await _context.ExamBatches.FindAsync(dto.BatchId);
            if (batch == null || batch.IsActive != true)
                return BadRequest(new { message = "Cannot register for an inactive or non-existent exam batch." });

            var qSet = await _context.QuestionSets.FindAsync(dto.QuestionSetId);
            if (qSet == null || qSet.IsActive != true)
                return BadRequest(new { message = "Cannot register for an inactive or non-existent question set." });

            // Item 11: Only block if an ACTIVE registration exists for this employee+batch
            var activeExists = await _context.ExamRegistrations
                .AnyAsync(r => r.HRRecordId == user.HRRecordId && r.BatchId == dto.BatchId && r.IsActive == true);

            if (activeExists)
                return BadRequest(new { message = "This employee is already registered in this exam batch. Duplicate active registration is not allowed." });

            // Item 12 (soft delete): if a soft-deleted (IsActive = 0) registration already exists for the
            // same employee + batch + question set, reactivate it instead of inserting a duplicate row.
            var inactiveReg = await _context.ExamRegistrations
                .FirstOrDefaultAsync(r => r.HRRecordId == user.HRRecordId
                    && r.BatchId == dto.BatchId
                    && r.QuestionSetId == dto.QuestionSetId
                    && r.IsActive != true);

            if (inactiveReg != null)
            {
                inactiveReg.ExamGradeId = dto.PromotedGradeId;
                inactiveReg.IsActive = true;
                inactiveReg.LastUpdateTime = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { message = "Employee registered for exam batch successfully (reactivated previous registration).", examineeId = inactiveReg.ExamineeId });
            }

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

        // PATCH /api/registrations/{id}/deactivate — soft delete (sets IsActive = false)
        [HttpPatch("{id}/deactivate")]
        public async Task<IActionResult> Deactivate(int id)
        {
            var reg = await _context.ExamRegistrations.FindAsync(id);
            if (reg == null)
                return NotFound(new { message = "Registration not found." });

            reg.IsActive = false;
            reg.LastUpdateTime = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Examinee unregistered successfully." });
        }

        // DELETE /api/registrations/{id} — hard delete (kept for admin use)
        [HttpDelete("{id}")]
        public async Task<IActionResult> Unregister(int id)
        {
            var reg = await _context.ExamRegistrations.FindAsync(id);
            if (reg == null)
                return NotFound(new { message = "Registration not found." });

            _context.ExamRegistrations.Remove(reg);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Examinee registration deleted." });
        }
    }
}
