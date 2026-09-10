using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.DTOs.Lookups;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class LookupsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LookupsController(ApplicationDbContext context)
        {
            _context = context;
        }

        #region Lookup Types
        [HttpGet("types")]
        public async Task<IActionResult> GetTypes()
        {
            var types = await _context.SysLookupTypes
                .OrderBy(t => t.Serial)
                .Select(t => new LookupTypeDto
                {
                    TypeId = t.TypeId,
                    LookupType = t.LookupType,
                    Serial = t.Serial,
                    IsActive = t.IsActive,
                    EntryDate = t.EntryDate
                })
                .ToListAsync();

            return Ok(types);
        }

        [HttpGet("types/overview")]
        public async Task<IActionResult> GetTypeOverview()
        {
            var total = await _context.SysLookupTypes.CountAsync();
            var active = await _context.SysLookupTypes.CountAsync(t => t.IsActive == true);
            var inactive = total - active;

            return Ok(new LookupTypeOverviewDto
            {
                Total = total,
                Active = active,
                InActive = inactive
            });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("types")]
        public async Task<IActionResult> SaveLookupType([FromBody] LookupTypeCreateUpdateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LookupType))
                return BadRequest(new { message = "Lookup Type name is required." });

            if (dto.TypeId.HasValue && dto.TypeId.Value > 0)
            {
                var existing = await _context.SysLookupTypes.FindAsync(dto.TypeId.Value);
                if (existing == null)
                    return NotFound(new { message = "Lookup Type not found." });

                existing.LookupType = dto.LookupType.Trim();
                existing.UpdateDate = DateTime.Now;
            }
            else
            {
                var nextSerial = (await _context.SysLookupTypes.MaxAsync(t => (int?)t.Serial) ?? 0) + 1;
                var newType = new SysLookupType
                {
                    LookupType = dto.LookupType.Trim(),
                    Serial = nextSerial,
                    IsActive = true,
                    EntryDate = DateTime.Now
                };
                _context.SysLookupTypes.Add(newType);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Lookup Type saved successfully." });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("types/toggle/{id}")]
        public async Task<IActionResult> ToggleTypeStatus(int id)
        {
            var type = await _context.SysLookupTypes.FindAsync(id);
            if (type == null)
                return NotFound(new { message = "Lookup Type not found." });

            type.IsActive = !(type.IsActive == true);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Status changed successfully.", isActive = type.IsActive });
        }
        #endregion

        #region Lookup Items
        [HttpGet("items")]
        public async Task<IActionResult> GetLookupItems([FromQuery] int? typeId, [FromQuery] bool includeInactive = false)
        {
            var query = _context.SysLookups.Include(l => l.LookupType).AsQueryable();
            if (typeId.HasValue && typeId.Value > 0)
            {
                query = query.Where(l => l.TypeId == typeId.Value);
            }

            if (!includeInactive)
            {
                query = query.Where(l => l.IsActive == true && (l.LookupType == null || l.LookupType.IsActive == true));
            }

            var items = await query
                .OrderBy(l => l.Serial)
                .Select(l => new LookupDto
                {
                    LookupId = l.LookupId,
                    TypeId = l.TypeId,
                    TypeName = l.LookupType != null ? l.LookupType.LookupType : null,
                    LookupText = l.LookupText,
                    LookupTextShort = l.LookupTextShort,
                    Serial = l.Serial,
                    IsActive = l.IsActive,
                    EntryDate = l.EntryDate
                })
                .ToListAsync();

            return Ok(items);
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("items")]
        public async Task<IActionResult> SaveLookupItem([FromBody] LookupCreateUpdateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LookupText))
                return BadRequest(new { message = "Lookup text is required." });

            if (dto.TypeId <= 0)
                return BadRequest(new { message = "Valid Lookup Type must be selected." });

            if (dto.LookupId.HasValue && dto.LookupId.Value > 0)
            {
                var existing = await _context.SysLookups.FindAsync(dto.LookupId.Value);
                if (existing == null)
                    return NotFound(new { message = "Lookup item not found." });

                existing.TypeId = dto.TypeId;
                existing.LookupText = dto.LookupText.Trim();
                existing.LookupTextShort = dto.LookupTextShort?.Trim();
                existing.UpdateDate = DateTime.Now;
            }
            else
            {
                var nextSerial = (await _context.SysLookups.Where(l => l.TypeId == dto.TypeId).MaxAsync(l => (int?)l.Serial) ?? 0) + 1;
                var newItem = new SysLookup
                {
                    TypeId = dto.TypeId,
                    LookupText = dto.LookupText.Trim(),
                    LookupTextShort = dto.LookupTextShort?.Trim(),
                    Serial = nextSerial,
                    IsActive = true,
                    EntryDate = DateTime.Now
                };
                _context.SysLookups.Add(newItem);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Lookup item saved successfully." });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("items/toggle/{id}")]
        public async Task<IActionResult> ToggleItemStatus(int id)
        {
            var item = await _context.SysLookups.FindAsync(id);
            if (item == null)
                return NotFound(new { message = "Lookup item not found." });

            item.IsActive = !(item.IsActive == true);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Status changed successfully.", isActive = item.IsActive });
        }
        #endregion

        #region Basic Data for Dropdowns
        [HttpGet("basic")]
        public async Task<IActionResult> GetBasicLookups()
        {
            var lookups = await _context.SysLookups
                .Where(l => l.IsActive == true && (l.LookupType == null || l.LookupType.IsActive == true))
                .Include(l => l.LookupType)
                .OrderBy(l => l.Serial)
                .Select(l => new
                {
                    l.LookupId,
                    l.TypeId,
                    TypeName = l.LookupType!.LookupType,
                    l.LookupText,
                    l.LookupTextShort
                })
                .ToListAsync();

            var grouped = lookups
                .GroupBy(l => l.TypeName)
                .ToDictionary(g => g.Key, g => g.ToList());

            return Ok(grouped);
        }
        #endregion
    }
}
