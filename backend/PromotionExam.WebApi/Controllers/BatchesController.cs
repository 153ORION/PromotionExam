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
    public class BatchesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public BatchesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetBatches([FromQuery] int? year)
        {
            var query = _context.ExamBatches.AsQueryable();
            if (year.HasValue && year.Value > 0)
                query = query.Where(b => b.ExamYear == year.Value);

            var batches = await query
                .OrderByDescending(b => b.BatchId)
                .Select(b => new ExamBatchDto
                {
                    BatchId = b.BatchId,
                    ExamName = b.ExamName,
                    ExamYear = b.ExamYear,
                    ExamStart = b.ExamStart,
                    ExamEnd = b.ExamEnd,
                    MCQQuestion = b.MCQQuestion,
                    MaxMCQ = b.MaxMCQ,
                    MCQMark = b.MCQMark,
                    AcademicQuestion = b.AcademicQuestion,
                    MaxAcademic = b.MaxAcademic,
                    GeneralQuestion = b.GeneralQuestion,
                    MaxGeneral = b.MaxGeneral,
                    JobRelatedQuestion = b.JobRelatedQuestion,
                    MaxJobRelated = b.MaxJobRelated,
                    TotalWrittenQuestion = b.TotalWrittenQuestion,
                    WrittenMark = b.WrittenMark,
                    TotalMark = b.TotalMark,
                    ExamDuration = b.ExamDuration,
                    IsActive = b.IsActive,
                    IsMultipleExaminer = b.IsMultipleExaminer,
                    AllowPreviewMarking = b.AllowPreviewMarking
                })
                .ToListAsync();

            return Ok(batches);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetBatchById(int id)
        {
            var b = await _context.ExamBatches.FindAsync(id);
            if (b == null)
                return NotFound(new { message = "Exam Batch not found." });

            var dto = new ExamBatchDto
            {
                BatchId = b.BatchId,
                ExamName = b.ExamName,
                ExamYear = b.ExamYear,
                ExamStart = b.ExamStart,
                ExamEnd = b.ExamEnd,
                MCQQuestion = b.MCQQuestion,
                MaxMCQ = b.MaxMCQ,
                MCQMark = b.MCQMark,
                AcademicQuestion = b.AcademicQuestion,
                MaxAcademic = b.MaxAcademic,
                GeneralQuestion = b.GeneralQuestion,
                MaxGeneral = b.MaxGeneral,
                JobRelatedQuestion = b.JobRelatedQuestion,
                MaxJobRelated = b.MaxJobRelated,
                TotalWrittenQuestion = b.TotalWrittenQuestion,
                WrittenMark = b.WrittenMark,
                TotalMark = b.TotalMark,
                ExamDuration = b.ExamDuration,
                IsActive = b.IsActive,
                IsMultipleExaminer = b.IsMultipleExaminer,
                AllowPreviewMarking = b.AllowPreviewMarking
            };

            return Ok(dto);
        }

        [HttpPost]
        public async Task<IActionResult> SaveBatch([FromBody] ExamBatchCreateUpdateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ExamName))
                return BadRequest(new { message = "Exam Name is required." });

            if (dto.BatchId.HasValue && dto.BatchId.Value > 0)
            {
                var existing = await _context.ExamBatches.FindAsync(dto.BatchId.Value);
                if (existing == null)
                    return NotFound(new { message = "Exam Batch not found." });

                existing.ExamName = dto.ExamName.Trim();
                existing.ExamYear = dto.ExamYear;
                existing.ExamStart = dto.ExamStart;
                existing.ExamEnd = dto.ExamEnd;
                existing.MCQQuestion = dto.MCQQuestion;
                existing.MaxMCQ = dto.MaxMCQ;
                existing.MCQMark = dto.MCQMark;
                existing.AcademicQuestion = dto.AcademicQuestion;
                existing.MaxAcademic = dto.MaxAcademic;
                existing.GeneralQuestion = dto.GeneralQuestion;
                existing.MaxGeneral = dto.MaxGeneral;
                existing.JobRelatedQuestion = dto.JobRelatedQuestion;
                existing.MaxJobRelated = dto.MaxJobRelated;
                existing.TotalWrittenQuestion = dto.TotalWrittenQuestion;
                existing.WrittenMark = dto.WrittenMark;
                existing.TotalMark = (dto.MCQMark ?? 0) + (dto.WrittenMark ?? 0);
                existing.ExamDuration = dto.ExamDuration;
                existing.IsMultipleExaminer = dto.IsMultipleExaminer ?? true;
                existing.AllowPreviewMarking = dto.AllowPreviewMarking ?? true;
            }
            else
            {
                var batch = new ExamBatch
                {
                    ExamName = dto.ExamName.Trim(),
                    ExamYear = dto.ExamYear,
                    ExamStart = dto.ExamStart,
                    ExamEnd = dto.ExamEnd,
                    MCQQuestion = dto.MCQQuestion,
                    MaxMCQ = dto.MaxMCQ,
                    MCQMark = dto.MCQMark,
                    AcademicQuestion = dto.AcademicQuestion,
                    MaxAcademic = dto.MaxAcademic,
                    GeneralQuestion = dto.GeneralQuestion,
                    MaxGeneral = dto.MaxGeneral,
                    JobRelatedQuestion = dto.JobRelatedQuestion,
                    MaxJobRelated = dto.MaxJobRelated,
                    TotalWrittenQuestion = dto.TotalWrittenQuestion,
                    WrittenMark = dto.WrittenMark,
                    TotalMark = (dto.MCQMark ?? 0) + (dto.WrittenMark ?? 0),
                    ExamDuration = dto.ExamDuration,
                    IsActive = true,
                    IsMultipleExaminer = dto.IsMultipleExaminer ?? true,
                    AllowPreviewMarking = dto.AllowPreviewMarking ?? true
                };
                _context.ExamBatches.Add(batch);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Exam Batch saved successfully." });
        }

        [HttpPost("toggle/{id}")]
        public async Task<IActionResult> ToggleBatchStatus(int id)
        {
            var batch = await _context.ExamBatches.FindAsync(id);
            if (batch == null)
                return NotFound(new { message = "Exam Batch not found." });

            batch.IsActive = !(batch.IsActive == true);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Status changed successfully.", isActive = batch.IsActive });
        }

        [HttpPost("time-editor")]
        public async Task<IActionResult> ExtendTime([FromBody] TimeEditorRequestDto request)
        {
            if (request.ExtraMinutes <= 0)
                return BadRequest(new { message = "Extra minutes must be greater than zero." });

            if (request.ExamineeId.HasValue && request.ExamineeId.Value > 0)
            {
                var reg = await _context.ExamRegistrations.FindAsync(request.ExamineeId.Value);
                if (reg == null)
                    return NotFound(new { message = "Examinee registration not found." });

                if (reg.ExamEnd.HasValue)
                {
                    reg.ExamEnd = reg.ExamEnd.Value.AddMinutes(request.ExtraMinutes);
                }
                reg.IsTimeExpire = false;
                await _context.SaveChangesAsync();
                return Ok(new { message = $"Extended {request.ExtraMinutes} minutes for examinee successfully." });
            }
            else if (request.BatchId.HasValue && request.BatchId.Value > 0)
            {
                var batch = await _context.ExamBatches.FindAsync(request.BatchId.Value);
                if (batch == null)
                    return NotFound(new { message = "Exam Batch not found." });

                if (batch.ExamEnd.HasValue)
                {
                    batch.ExamEnd = batch.ExamEnd.Value.AddMinutes(request.ExtraMinutes);
                }
                batch.ExamDuration = (batch.ExamDuration ?? 0) + request.ExtraMinutes;

                // Also extend for active registrations in this batch
                var activeRegs = await _context.ExamRegistrations
                    .Where(r => r.BatchId == request.BatchId.Value && r.IsExamEnd != true)
                    .ToListAsync();

                foreach (var r in activeRegs)
                {
                    if (r.ExamEnd.HasValue)
                        r.ExamEnd = r.ExamEnd.Value.AddMinutes(request.ExtraMinutes);
                    r.IsTimeExpire = false;
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = $"Extended {request.ExtraMinutes} minutes for batch and active candidates successfully." });
            }

            return BadRequest(new { message = "Either Batch ID or Examinee ID must be provided." });
        }
    }
}
