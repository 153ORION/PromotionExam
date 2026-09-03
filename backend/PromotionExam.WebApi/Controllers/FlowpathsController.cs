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
                .ToDictionaryAsync(u => (int)u.HRRecordId, u => new { u.Name, u.Designation, u.DepartmentName });

            var list = await query.OrderBy(f => f.Rank).ToListAsync();

            var result = list.Select(f => new SysFlowpathDto
            {
                Path_Id = f.Path_Id,
                BatchId = f.BatchId,
                BatchName = batches.ContainsKey(f.BatchId) ? batches[f.BatchId] : null,
                ExamSetId = f.ExamSetId,
                SetName = sets.ContainsKey(f.ExamSetId) ? sets[f.ExamSetId] : null,
                ExaminerId = f.ExaminerId,
                ExaminerName = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].Name : null,
                ExaminerDesignation = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].Designation : null,
                ExaminerDepartment = examiners.ContainsKey(f.ExaminerId) ? examiners[f.ExaminerId].DepartmentName : null,
                Rank = f.Rank,
                Approver = f.Approver,
                EntryDate = f.EntryDate
            }).ToList();

            return Ok(result);
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
                EntryDate = DateTime.UtcNow
            };

            _context.SysFlowpaths.Add(flowpath);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Examiner flow path assigned successfully." });
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
