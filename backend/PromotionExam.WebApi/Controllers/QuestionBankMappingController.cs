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
using PromotionExam.Infrastructure.Data;
using PromotionExam.Infrastructure.Services;

namespace PromotionExam.WebApi.Controllers
{
    // Question Bank > Lookup Mapping: maps the Department, Grade, Location and Concentration text of
    // uploaded questions (Bulk_Questions_Excel) to Sys_Lookup ids (DepartmentId, GradeId, LocationId,
    // ConcentrationId). A mapping applies to every row with the same text. The user can list the
    // rows a value covers before applying. Sys_Lookup may not have every item yet; unmapped values
    // simply stay null until the item is added and mapped.
    //
    // {field}: department | grade | location | concentration
    [Authorize(Policy = "AdminOnly")]
    [ApiController]
    [Route("api/question-bank-mapping")]
    public class QuestionBankMappingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IUserActivityService _activityService;

        public QuestionBankMappingController(ApplicationDbContext context, IUserActivityService activityService)
        {
            _context = context;
            _activityService = activityService;
        }

        private long GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            long.TryParse(userIdClaim, out var userId);
            return userId;
        }

        // Sys_Lookup items of all four fields, keyed by field (department, grade, location,
        // concentration): the filter dropdowns of Question Bank > Questions.
        [HttpGet("options")]
        public async Task<IActionResult> GetAllOptions()
        {
            var result = new Dictionary<string, LookupMappingFieldDto>();
            foreach (var f in BulkQuestionLookupField.All)
            {
                var (typeFound, options) = await GetOptionsAsync(f);
                result[f.Key] = new LookupMappingFieldDto
                {
                    Field = f.Key, Label = f.Label, LookupType = f.LookupType, LookupTypeFound = typeFound, Options = options
                };
            }
            return Ok(result);
        }

        // Every distinct text of the field with its row count and current mapping, plus the
        // Sys_Lookup items that can be chosen.
        [HttpGet("{field}")]
        public async Task<IActionResult> GetField(string field)
        {
            var f = BulkQuestionLookupField.Find(field);
            if (f == null) return NotFound(new { message = $"Unknown field '{field}'." });

            var (typeFound, options) = await GetOptionsAsync(f);
            var names = options.ToDictionary(o => o.LookupId, o => o.LookupText);

            var groups = await _context.BulkQuestionsExcel
                .Select(f.Pair)
                .GroupBy(p => new { p.Text, p.Id })
                .Select(g => new { g.Key.Text, g.Key.Id, Count = g.Count() })
                .ToListAsync();

            var values = groups
                .Where(g => !string.IsNullOrEmpty(g.Text))
                .GroupBy(g => g.Text!, StringComparer.OrdinalIgnoreCase)
                .Select(g => new LookupMappingValueDto
                {
                    Value = g.OrderByDescending(x => x.Count).First().Text!,
                    RowCount = g.Sum(x => x.Count),
                    UnmappedRowCount = g.Where(x => x.Id == null).Sum(x => x.Count),
                    Targets = g.GroupBy(x => x.Id)
                        .Select(t => new LookupMappingTargetDto
                        {
                            LookupId = t.Key,
                            LookupText = t.Key.HasValue ? names.GetValueOrDefault(t.Key.Value, $"Lookup #{t.Key} (not found)") : null,
                            RowCount = t.Sum(x => x.Count)
                        })
                        .OrderByDescending(t => t.RowCount)
                        .ToList(),
                    SuggestedLookupId = Suggest(g.Key, options)
                })
                .OrderBy(v => v.Value, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(new LookupMappingFieldDto
            {
                Field = f.Key,
                Label = f.Label,
                LookupType = f.LookupType,
                LookupTypeFound = typeFound,
                Options = options,
                Values = values,
                EmptyRowCount = groups.Where(g => string.IsNullOrEmpty(g.Text)).Sum(g => g.Count)
            });
        }

        // The rows a value covers, i.e. the rows a mapping of that value changes.
        [HttpGet("{field}/rows")]
        public async Task<IActionResult> GetRows(string field, [FromQuery] string value, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
        {
            var f = BulkQuestionLookupField.Find(field);
            if (f == null) return NotFound(new { message = $"Unknown field '{field}'." });
            if (string.IsNullOrEmpty(value)) return BadRequest(new { message = "Choose a value." });

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var query = _context.BulkQuestionsExcel.Where(f.TextEquals(value));
            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(q => q.UploadedAt).ThenBy(q => q.ExcelRowNo)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new BulkQuestionRowPageDto
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                Items = items.Select(QuestionBankUploadController.ToRowDto).ToList()
            });
        }

        // Sets (or clears, LookupId = null) the lookup id of every row with each given text.
        [HttpPost("{field}")]
        public async Task<IActionResult> Save(string field, [FromBody] SaveLookupMappingDto dto)
        {
            var f = BulkQuestionLookupField.Find(field);
            if (f == null) return NotFound(new { message = $"Unknown field '{field}'." });

            var items = (dto.Items ?? new List<LookupMappingItemDto>())
                .Where(i => !string.IsNullOrWhiteSpace(i.Value))
                .ToList();
            if (items.Count == 0) return BadRequest(new { message = "Choose at least one value to map." });

            var (_, options) = await GetOptionsAsync(f);
            var validIds = options.Select(o => o.LookupId).ToHashSet();
            var invalid = items.Where(i => i.LookupId.HasValue && !validIds.Contains(i.LookupId.Value)).ToList();
            if (invalid.Count > 0)
                return BadRequest(new { message = $"Lookup id(s) {string.Join(", ", invalid.Select(i => i.LookupId))} are not {f.LookupType} items in Sys_Lookup." });

            int updated = 0;
            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                foreach (var item in items)
                {
                    var lookupId = item.LookupId;
                    updated += await _context.BulkQuestionsExcel
                        .Where(f.TextEquals(item.Value))
                        .ExecuteUpdateAsync(s => s.SetProperty(f.Id, lookupId));
                }
                await transaction.CommitAsync();
            }

            var names = options.ToDictionary(o => o.LookupId, o => o.LookupText);
            var summary = string.Join(", ", items.Select(i =>
                $"'{i.Value}' -> {(i.LookupId.HasValue ? $"'{names[i.LookupId.Value]}' (#{i.LookupId})" : "not mapped")}"));

            await LogAsync("BULK_QUESTION_LOOKUP_MAP",
                $"Mapped {f.Label}: {summary}. {updated} row(s) updated.",
                JsonSerializer.Serialize(new { field = f.Key, items, updatedRows = updated }));

            return Ok(new SaveLookupMappingResultDto
            {
                UpdatedRows = updated,
                Message = items.Count == 1
                    ? $"{f.Label} '{items[0].Value}' {(items[0].LookupId.HasValue ? $"mapped to '{names[items[0].LookupId!.Value]}'" : "unmapped")}: {updated} row(s) updated."
                    : $"{items.Count} {f.Label.ToLowerInvariant()} value(s) mapped: {updated} row(s) updated."
            });
        }

        // Sys_Lookup items of the field's lookup type, inactive ones included so existing mappings
        // still show a name.
        private async Task<(bool TypeFound, List<LookupMappingOptionDto> Options)> GetOptionsAsync(BulkQuestionLookupField f)
        {
            var typeIds = await _context.SysLookupTypes
                .Where(t => t.LookupType == f.LookupType)
                .Select(t => t.TypeId)
                .ToListAsync();
            if (typeIds.Count == 0) return (false, new List<LookupMappingOptionDto>());

            var options = await _context.SysLookups
                .Where(l => typeIds.Contains(l.TypeId))
                .OrderBy(l => l.Serial).ThenBy(l => l.LookupText)
                .Select(l => new LookupMappingOptionDto
                {
                    LookupId = l.LookupId,
                    LookupText = l.LookupText,
                    LookupTextShort = l.LookupTextShort,
                    IsActive = l.IsActive == true
                })
                .ToListAsync();
            return (true, options);
        }

        // The single active lookup whose text or short text equals the value, ignoring case, spaces
        // and punctuation ("E-1" = "E1").
        private static int? Suggest(string value, List<LookupMappingOptionDto> options)
        {
            static string Code(string? v) => new string((v ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
            var code = Code(value);
            if (code.Length == 0) return null;

            var matches = options
                .Where(o => o.IsActive && (Code(o.LookupText) == code || Code(o.LookupTextShort) == code))
                .Select(o => o.LookupId)
                .Distinct()
                .ToList();
            return matches.Count == 1 ? matches[0] : null;
        }

        private async Task LogAsync(string action, string description, string detailsJson)
        {
            var userId = GetCurrentUserId();
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
