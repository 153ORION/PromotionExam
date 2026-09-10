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
    [Authorize(Policy = "AdminOnly")]
    [ApiController]
    [Route("api/[controller]")]
    public class FlowpathsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FlowpathsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetFlowpaths([FromQuery] int? batchId, [FromQuery] int? setId)
        {
            var query = _context.SysFlowpaths.AsQueryable();

            if (batchId.HasValue && batchId.Value > 0)
                query = query.Where(f => f.BatchId == batchId.Value);

            if (setId.HasValue && setId.Value > 0)
                query = query.Where(f => f.ExamSetId == setId.Value);

            var batches = await _context.ExamBatches.ToDictionaryAsync(b => b.BatchId, b => b.ExamName);
            var sets = await _context.QuestionSets.ToDictionaryAsync(s => s.SetId, s => s.SetName);
            var examiners = await _context.SysUserRegistrations
                .ToDictionaryAsync(u => (int)u.HRRecordId, u => new { u.LoginId, u.Name, u.Designation, u.DepartmentName });

            var list = await query.OrderBy(f => f.Rank).ToListAsync();

            var result = list.Select(f => new SysFlowpathDto
            {
                Path_Id = f.Path_Id,
                BatchId = f.BatchId,
                BatchName = batches.ContainsKey(f.BatchId) ? batches[f.BatchId] : null,
                ExamSetId = f.ExamSetId,
                SetName = sets.ContainsKey(f.ExamSetId) ? sets[f.ExamSetId] : null,
                ExaminerId = f.ExaminerId,
                ExaminerCode = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].LoginId : null,
                ExaminerName = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].Name : null,
                ExaminerDesignation = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].Designation : null,
                ExaminerDepartment = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].DepartmentName : null,
                Rank = f.Rank,
                Approver = f.Approver,
                EntryDate = f.EntryDate
            }).ToList();

            return Ok(result);
        }

        [HttpGet("examiners")]
        public async Task<IActionResult> GetExaminers([FromQuery] string? search)
        {
            var query = _context.SysUserRegistrations
                .Where(u => u.IsActive == true);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(u => u.LoginId.Contains(s) || u.Name.Contains(s));
            }

            var list = await query
                .OrderBy(u => u.Name)
                .Take(200)
                .Select(u => new
                {
                    hrRecordId = (int)u.HRRecordId,
                    loginId = u.LoginId,
                    name = u.Name,
                    designation = u.Designation,
                    departmentName = u.DepartmentName,
                    locationName = u.LocationName
                })
                .ToListAsync();

            return Ok(list);
        }

        [HttpPost]
        public async Task<IActionResult> CreateFlowpath([FromBody] FlowpathCreateDto dto)
        {
            if (dto.BatchId <= 0 || dto.ExamSetId <= 0 || dto.ExaminerId <= 0)
                return BadRequest(new { message = "Batch, Question Set, and Examiner are required." });

            var exists = await _context.SysFlowpaths
                .AnyAsync(f => f.BatchId == dto.BatchId && f.ExamSetId == dto.ExamSetId && f.ExaminerId == dto.ExaminerId);

            if (exists)
                return BadRequest(new { message = "This examiner is already assigned to this batch and set." });

            var flowpath = new SysFlowpath
            {
                BatchId = dto.BatchId,
                ExamSetId = dto.ExamSetId,
                ExaminerId = dto.ExaminerId,
                Rank = dto.Rank > 0 ? dto.Rank : 1,
                Approver = dto.Approver,
                EntryDate = DateTime.Now
            };

            _context.SysFlowpaths.Add(flowpath);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Examiner flow path assigned successfully." });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateFlowpath(int id, [FromBody] FlowpathUpdateDto dto)
        {
            if (dto.ExaminerId <= 0)
                return BadRequest(new { message = "A valid examiner is required." });

            if (dto.Rank < 1)
                return BadRequest(new { message = "Rank must be 1 or higher." });

            var flowpath = await _context.SysFlowpaths.FindAsync(id);
            if (flowpath == null)
                return NotFound(new { message = "Flow path not found." });

            var examinerExists = await _context.SysUserRegistrations
                .AnyAsync(u => u.IsActive == true && u.HRRecordId == dto.ExaminerId);
            if (!examinerExists)
                return BadRequest(new { message = "Selected examiner is not an active employee." });

            var duplicate = await _context.SysFlowpaths
                .AnyAsync(f => f.Path_Id != id
                    && f.BatchId == flowpath.BatchId
                    && f.ExamSetId == flowpath.ExamSetId
                    && f.ExaminerId == dto.ExaminerId);
            if (duplicate)
                return BadRequest(new { message = "This examiner is already assigned to this batch and set." });

            flowpath.ExaminerId = dto.ExaminerId;
            flowpath.Rank = dto.Rank;
            flowpath.Approver = dto.Approver;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Flow path updated successfully." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFlowpath(int id)
        {
            var flowpath = await _context.SysFlowpaths.FindAsync(id);
            if (flowpath == null)
                return NotFound(new { message = "Flow path not found." });

            _context.SysFlowpaths.Remove(flowpath);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Flow path assignment removed successfully." });
        }
    }
}
