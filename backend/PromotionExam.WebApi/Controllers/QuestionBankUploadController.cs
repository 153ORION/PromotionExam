using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.Questions;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;
using PromotionExam.Infrastructure.Services;

namespace PromotionExam.WebApi.Controllers
{
    // Question Bank > Upload Excel and Question Bank > Fix Questions.
    //
    // Upload: the question sheet of a Question Bank Excel file is validated first (validate), then
    // saved to Bulk_Questions_Excel in one transaction (upload). Rows with errors are saved too,
    // flagged HasError with their error messages, so they can be corrected instead of re-uploaded.
    // A row that repeats the same question for the same part/grade/department/concentration/location
    // (in the file or in an earlier upload) is a duplicate: the uploader chooses to skip or keep it.
    // A row whose Type is not MCQ/Descriptive or whose Part is not 1/2/3 is saved as disputed.
    // A row's Concentration gets the id of the Sys_Lookup Concentration item with the same name;
    // a name not in Sys_Lookup yet is added there.
    //
    // Fix Questions: lists disputed and error rows; sets Type/Part in bulk, edits a whole row
    // (re-checked with the upload rules) or deletes rows.
    //
    // Questions: a question can also be typed in by hand; it is saved under the "Manual entry" batch.
    [Authorize(Policy = "AdminOnly")]
    [ApiController]
    [Route("api/question-bank-upload")]
    public class QuestionBankUploadController : ControllerBase
    {
        private const long MaxFileBytes = 10 * 1024 * 1024;
        private static readonly string[] AllowedExtensions = { ".xlsx", ".xls" };
        // Sys_LookupType id of Concentration.
        private const int ConcentrationLookupTypeId = 7;
        // Questions typed in on Question Bank > Questions share one batch, numbered 1, 2, 3… as rows.
        private static readonly Guid ManualEntryBatchId = new("00000000-0000-0000-0000-000000000001");
        private const string ManualEntryFileName = "Manual entry";
        private const string DeleteDuplicateHint = " Delete this row if it is not needed.";

        private readonly ApplicationDbContext _context;
        private readonly IUserActivityService _activityService;

        public QuestionBankUploadController(ApplicationDbContext context, IUserActivityService activityService)
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

        #region Upload

        // Parses and validates the file without saving anything.
        [HttpPost("validate")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxFileBytes + 1024 * 1024)]
        public async Task<IActionResult> Validate(IFormFile file, [FromForm] string? sheetName)
        {
            var (result, _, error) = await ReadAndValidateAsync(file, sheetName);
            if (error != null) return error;
            return Ok(result);
        }

        // Validates the file again and saves it in one transaction.
        //  keepDuplicateRows: JSON array of Excel row numbers of duplicates to save anyway; other duplicates are skipped.
        // Rows with errors are saved with HasError set and fixed later in Fix Questions.
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxFileBytes + 1024 * 1024)]
        public async Task<IActionResult> Upload(
            IFormFile file,
            [FromForm] string? sheetName,
            [FromForm] string? keepDuplicateRows)
        {
            var (result, fileHash, error) = await ReadAndValidateAsync(file, sheetName);
            if (error != null) return error;

            if (result!.HasFileError || result.TotalRows == 0)
                return BadRequest(new { message = "The file cannot be imported. Nothing was saved.", validation = result });

            HashSet<int> keepRows;
            try
            {
                keepRows = string.IsNullOrWhiteSpace(keepDuplicateRows)
                    ? new HashSet<int>()
                    : JsonSerializer.Deserialize<HashSet<int>>(keepDuplicateRows) ?? new HashSet<int>();
            }
            catch (JsonException)
            {
                return BadRequest(new { message = "keepDuplicateRows must be a JSON array of row numbers." });
            }

            // Duplicate detection skips error rows, so a duplicate never has errors.
            var duplicateRows = result.Rows.Where(IsDuplicateRow).ToList();
            var keptDuplicates = duplicateRows.Where(r => keepRows.Contains(r.ExcelRowNo)).ToList();
            var toSave = result.Rows
                .Where(r => !IsDuplicateRow(r) || keepRows.Contains(r.ExcelRowNo))
                .ToList();

            if (toSave.Count == 0)
                return BadRequest(new { message = "There is nothing to save: every row was skipped as a duplicate.", validation = result });

            var errorsByRow = result.Issues
                .Where(i => i.RowNo.HasValue && i.Severity == "Error")
                .GroupBy(i => i.RowNo!.Value)
                .ToDictionary(g => g.Key, g => g.Select(i => i.Message).ToList());

            var userId = GetCurrentUserId();
            var batchId = Guid.NewGuid();
            var now = DateTime.Now;

            var entities = toSave.Select(r =>
            {
                var errors = r.HasError && errorsByRow.TryGetValue(r.ExcelRowNo, out var list) ? new List<string>(list) : new List<string>();
                var questionType = Fit(r.QuestionType, "QuestionType", "Type", errors);
                var questionPart = Fit(r.QuestionPart, "QuestionPart", "Part", errors);
                return new BulkQuestionExcel
                {
                    UploadBatchId = batchId,
                    FileName = result.FileName,
                    SheetName = result.SheetName,
                    FileHash = fileHash,
                    ExcelRowNo = r.ExcelRowNo,
                    Grade = Fit(r.Grade, "Grade", "Grade", errors),
                    Department = Fit(r.Department, "Department", "Department", errors),
                    JobConcentration = Fit(r.JobConcentration, "JobConcentration", "Concentration", errors),
                    Location = Fit(r.Location, "Location", "Location", errors),
                    QuestionPart = questionPart,
                    QuestionType = questionType,
                    Question = r.Question,
                    Option1 = r.Option1,
                    Option2 = r.Option2,
                    Option3 = r.Option3,
                    Option4 = r.Option4,
                    RightAnswer = r.RightAnswer,
                    IsTypeDisputed = r.IsTypeDisputed,
                    IsPartDisputed = r.IsPartDisputed,
                    OriginalQuestionType = r.IsTypeDisputed ? questionType : null,
                    OriginalQuestionPart = r.IsPartDisputed ? questionPart : null,
                    IsDuplicate = IsDuplicateRow(r),
                    HasError = r.HasError,
                    ErrorMessages = errors.Count > 0 ? string.Join("\n", errors) : null,
                    UploadedBy = userId > 0 ? userId : null,
                    UploadedAt = now
                };
            }).ToList();

            // The new Concentration lookups and the rows are saved in one transaction: either all or none.
            int createdConcentrations;
            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                // Department/Grade/Location/Concentration text already mapped in Lookup Mapping gets its id.
                await BulkQuestionLookupField.ApplyKnownMappingsAsync(_context, entities);

                // Concentration text gets the id of the Sys_Lookup Concentration item with the same name,
                // or of a new item when there is none.
                createdConcentrations = await BulkQuestionLookupField.Concentration.MatchOrCreateLookupsAsync(
                    _context, entities, ConcentrationLookupTypeId, userId > 0 ? userId : null);

                _context.BulkQuestionsExcel.AddRange(entities);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }

            int errorRows = entities.Count(e => e.HasError);
            int disputed = entities.Count(e => !e.HasError && (e.IsTypeDisputed || e.IsPartDisputed));
            int skippedDuplicates = duplicateRows.Count - keptDuplicates.Count;

            await LogAsync(userId, "BULK_QUESTION_UPLOAD",
                $"Uploaded question bank Excel '{result.FileName}' (sheet '{result.SheetName}'): {entities.Count} saved, {skippedDuplicates} duplicate(s) skipped, {errorRows} with errors, {disputed} disputed.",
                JsonSerializer.Serialize(new
                {
                    uploadBatchId = batchId, result.FileName, result.SheetName, saved = entities.Count,
                    skippedDuplicates, keptDuplicates = keptDuplicates.Count, errorRows, disputed, createdConcentrations
                }));

            var parts = new List<string> { $"{entities.Count} question(s) saved from '{result.FileName}'" };
            if (skippedDuplicates > 0) parts.Add($"{skippedDuplicates} duplicate(s) skipped");
            if (keptDuplicates.Count > 0) parts.Add($"{keptDuplicates.Count} duplicate(s) kept");
            if (errorRows > 0) parts.Add($"{errorRows} row(s) with errors");
            if (disputed > 0) parts.Add($"{disputed} disputed question(s)");
            if (createdConcentrations > 0) parts.Add($"{createdConcentrations} new Concentration lookup(s) added");
            var message = string.Join("; ", parts) + ".";
            if (errorRows + disputed > 0) message += " Correct them in Fix Questions.";

            return Ok(new BulkQuestionUploadResultDto
            {
                UploadBatchId = batchId,
                FileName = result.FileName,
                SavedRows = entities.Count,
                SkippedDuplicateRows = skippedDuplicates,
                KeptDuplicateRows = keptDuplicates.Count,
                ErrorRows = errorRows,
                DisputedRows = disputed,
                Message = message
            });
        }

        // A row with errors may hold a value longer than its database column (a TOO_LONG error).
        // The value is cut to fit and the row's errors say so.
        private static string? Fit(string? value, string key, string label, List<string> errors)
        {
            int max = BulkQuestionExcelParser.MaxLength(key);
            if (value == null || max == 0 || value.Length <= max) return value;
            errors.Add($"{label} was cut to {max} characters when saved; check the value.");
            return value[..max];
        }

        private static bool IsDuplicateRow(BulkQuestionRowDto r) => r.DuplicateOfRowNo.HasValue || r.DuplicateOfBulkQuestionId.HasValue;

        [HttpGet("batches")]
        public async Task<IActionResult> GetBatches()
        {
            var batches = await _context.BulkQuestionsExcel
                .GroupBy(q => q.UploadBatchId)
                .Select(g => new BulkQuestionBatchDto
                {
                    UploadBatchId = g.Key,
                    FileName = g.Max(q => q.FileName)!,
                    SheetName = g.Max(q => q.SheetName),
                    UploadedAt = g.Min(q => q.UploadedAt),
                    UploadedBy = g.Max(q => q.UploadedBy),
                    RowCount = g.Count(),
                    McqCount = g.Sum(q => q.QuestionType == BulkQuestionExcelParser.TypeMcq ? 1 : 0),
                    DisputedCount = g.Sum(q => q.IsTypeDisputed || q.IsPartDisputed ? 1 : 0),
                    ErrorCount = g.Sum(q => q.HasError ? 1 : 0),
                    DuplicateCount = g.Sum(q => q.IsDuplicate ? 1 : 0)
                })
                .OrderByDescending(b => b.UploadedAt)
                .ToListAsync();

            var names = await GetUserNamesAsync(batches.Where(b => b.UploadedBy.HasValue).Select(b => b.UploadedBy!.Value));
            foreach (var b in batches)
            {
                if (b.UploadedBy.HasValue && names.TryGetValue(b.UploadedBy.Value, out var name))
                    b.UploadedByName = name;
            }

            return Ok(batches);
        }

        // Question Bank > Questions: every saved row, filtered by the Sys_Lookup ids set in
        // Lookup Mapping. Each id filter takes a lookup id, or "none" for rows not mapped yet.
        [HttpGet("questions")]
        public async Task<IActionResult> GetQuestions(
            [FromQuery] string? departmentId,
            [FromQuery] string? gradeId,
            [FromQuery] string? locationId,
            [FromQuery] string? concentrationId,
            [FromQuery] string? questionType,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25)
        {
            var query = _context.BulkQuestionsExcel.AsQueryable();

            var idFilters = new[]
            {
                (Field: BulkQuestionLookupField.Department, Value: departmentId),
                (Field: BulkQuestionLookupField.Grade, Value: gradeId),
                (Field: BulkQuestionLookupField.Location, Value: locationId),
                (Field: BulkQuestionLookupField.Concentration, Value: concentrationId),
            };
            foreach (var (field, value) in idFilters)
            {
                if (string.IsNullOrWhiteSpace(value)) continue;
                if (string.Equals(value, "none", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(field.IdEquals(null));
                else if (int.TryParse(value, out var id))
                    query = query.Where(field.IdEquals(id));
                else
                    return BadRequest(new { message = $"{field.Label} filter must be a lookup id or 'none'." });
            }

            if (!string.IsNullOrWhiteSpace(questionType))
                query = query.Where(q => q.QuestionType == questionType);

            return Ok(await PageAsync(ApplySearch(query, search), page, pageSize, orderByUpload: true));
        }

        // Question Bank > Questions > New question: saves one question typed in by hand. It is checked
        // with the same rules as an uploaded row but, unlike an upload, saved only when it is valid.
        // A question that repeats a saved one (same part, grade, department, concentration and location)
        // is refused with 409 unless allowDuplicate is set; then it is saved and marked IsDuplicate.
        // Lookup text without a picked id gets the id that text is already mapped to, as in an upload.
        [HttpPost("questions")]
        public async Task<IActionResult> CreateQuestion([FromBody] CreateBulkQuestionDto dto, [FromQuery] bool allowDuplicate = false)
        {
            // Lookup ids picked from Sys_Lookup: the question takes the item's text.
            var picked = new Dictionary<BulkQuestionLookupField, (int Id, string Text)>();
            foreach (var (field, id) in new[]
            {
                (BulkQuestionLookupField.Department, dto.DepartmentId),
                (BulkQuestionLookupField.Grade, dto.GradeId),
                (BulkQuestionLookupField.Location, dto.LocationId),
                (BulkQuestionLookupField.Concentration, dto.ConcentrationId),
            })
            {
                if (id == null) continue;
                var typeIds = _context.SysLookupTypes.Where(t => t.LookupType == field.LookupType).Select(t => t.TypeId);
                var text = await _context.SysLookups
                    .Where(l => l.LookupId == id.Value && typeIds.Contains(l.TypeId))
                    .Select(l => l.LookupText)
                    .FirstOrDefaultAsync();
                if (text == null)
                    return BadRequest(new { message = $"Lookup #{id} is not a {field.LookupType} item in Sys_Lookup." });
                picked[field] = (id.Value, text);
            }
            string? TextOf(BulkQuestionLookupField field, string? typed) => picked.TryGetValue(field, out var p) ? p.Text : typed;

            var rowNo = (await _context.BulkQuestionsExcel
                .Where(q => q.UploadBatchId == ManualEntryBatchId)
                .MaxAsync(q => (int?)q.ExcelRowNo) ?? 0) + 1;

            var row = new BulkQuestionRowDto
            {
                ExcelRowNo = rowNo,
                Grade = TextOf(BulkQuestionLookupField.Grade, dto.Grade),
                Department = TextOf(BulkQuestionLookupField.Department, dto.Department),
                JobConcentration = TextOf(BulkQuestionLookupField.Concentration, dto.JobConcentration),
                Location = TextOf(BulkQuestionLookupField.Location, dto.Location),
                QuestionPart = dto.QuestionPart,
                QuestionType = dto.QuestionType,
                Question = dto.Question ?? string.Empty,
                Option1 = dto.Option1,
                Option2 = dto.Option2,
                Option3 = dto.Option3,
                Option4 = dto.Option4,
                RightAnswer = dto.RightAnswer
            };
            var issues = BulkQuestionExcelParser.ValidateQuestion(row);

            // Type and Part must be valid: a typed-in question is never saved as disputed.
            var problems = issues.Where(i => i.Severity == "Error").ToList();
            if (row.IsTypeDisputed)
                problems.Add(new BulkQuestionIssueDto { Column = "Type", Severity = "Error", Code = "DISPUTED_TYPE", Message = "Choose a Type: MCQ or Descriptive." });
            if (row.IsPartDisputed)
                problems.Add(new BulkQuestionIssueDto { Column = "Part", Severity = "Error", Code = "DISPUTED_PART", Message = "Choose a Part: 1, 2 or 3." });
            if (problems.Count > 0)
                return BadRequest(new { message = "The question was not saved. " + string.Join(" ", problems.Select(i => i.Message)), issues = problems });

            var warnings = issues.Where(i => i.Severity != "Error").ToList();
            var userId = GetCurrentUserId();
            var entity = new BulkQuestionExcel
            {
                UploadBatchId = ManualEntryBatchId,
                FileName = ManualEntryFileName,
                ExcelRowNo = rowNo,
                Grade = row.Grade,
                Department = row.Department,
                JobConcentration = row.JobConcentration,
                Location = row.Location,
                QuestionPart = row.QuestionPart,
                QuestionType = row.QuestionType,
                Question = row.Question,
                Option1 = row.Option1,
                Option2 = row.Option2,
                Option3 = row.Option3,
                Option4 = row.Option4,
                RightAnswer = row.RightAnswer,
                UploadedBy = userId > 0 ? userId : null,
                UploadedAt = DateTime.Now
            };

            var duplicates = await MarkDuplicatesAsync(new[] { entity });
            if (duplicates.TryGetValue(entity.BulkQuestionId, out var duplicateMessage))
            {
                if (!allowDuplicate)
                    return Conflict(new { message = duplicateMessage, duplicate = true });
                warnings.Add(new BulkQuestionIssueDto { Column = "Question", Severity = "Warning", Code = "DUPLICATE", Message = duplicateMessage + DeleteDuplicateHint });
            }

            // A new Concentration lookup and the question are saved together: either both or neither.
            int createdConcentrations;
            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                await BulkQuestionLookupField.ApplyKnownMappingsAsync(_context, new[] { entity });
                createdConcentrations = await BulkQuestionLookupField.Concentration.MatchOrCreateLookupsAsync(
                    _context, new[] { entity }, ConcentrationLookupTypeId, userId > 0 ? userId : null);
                // A picked id wins over the id found from the text.
                foreach (var (field, p) in picked) field.SetId(entity, p.Id);

                _context.BulkQuestionsExcel.Add(entity);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }

            await LogAsync(userId, "BULK_QUESTION_CREATE",
                $"Created question #{entity.BulkQuestionId} ({entity.QuestionType}, part {entity.QuestionPart}) by manual entry{(entity.IsDuplicate ? "; it repeats a saved question" : "")}.",
                JsonSerializer.Serialize(new
                {
                    bulkQuestionId = entity.BulkQuestionId, entity.ExcelRowNo, entity.QuestionType, entity.QuestionPart,
                    entity.IsDuplicate, createdConcentrations
                }));

            var message = $"Question saved ({entity.QuestionType}, Part {entity.QuestionPart}).";
            if (entity.IsDuplicate) message += " It repeats a saved question and is marked as a duplicate.";
            if (createdConcentrations > 0) message += $" New Concentration lookup '{entity.JobConcentration}' added.";
            return Ok(new { message, row = ToRowDto(entity), issues = warnings });
        }

        [HttpGet("batches/{batchId:guid}/rows")]
        public async Task<IActionResult> GetBatchRows(
            Guid batchId,
            [FromQuery] string? search,
            [FromQuery] string? questionType,
            [FromQuery] bool disputedOnly = false,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25)
        {
            var query = _context.BulkQuestionsExcel.Where(q => q.UploadBatchId == batchId);

            if (!string.IsNullOrWhiteSpace(questionType))
                query = query.Where(q => q.QuestionType == questionType);
            if (disputedOnly)
                query = query.Where(q => q.IsTypeDisputed || q.IsPartDisputed);

            return Ok(await PageAsync(ApplySearch(query, search), page, pageSize));
        }

        [HttpDelete("batches/{batchId:guid}")]
        public async Task<IActionResult> DeleteBatch(Guid batchId)
        {
            var fileName = await _context.BulkQuestionsExcel
                .Where(q => q.UploadBatchId == batchId)
                .Select(q => q.FileName)
                .FirstOrDefaultAsync();

            if (fileName == null)
                return NotFound(new { message = "Upload not found." });

            var deleted = await _context.BulkQuestionsExcel
                .Where(q => q.UploadBatchId == batchId)
                .ExecuteDeleteAsync();

            await LogAsync(GetCurrentUserId(), "BULK_QUESTION_DELETE",
                $"Deleted uploaded question bank Excel '{fileName}' ({deleted} rows).",
                JsonSerializer.Serialize(new { uploadBatchId = batchId, fileName, rows = deleted }));

            return Ok(new { message = $"Deleted {deleted} row(s) uploaded from '{fileName}'.", deleted });
        }

        #endregion

        #region Fix Questions

        // Rows that need fixing: disputed Type/Part, validation errors, or both.
        private IQueryable<BulkQuestionExcel> RowsToFix(Guid? batchId)
        {
            var query = _context.BulkQuestionsExcel.Where(q => q.HasError || q.IsTypeDisputed || q.IsPartDisputed);
            return batchId.HasValue ? query.Where(q => q.UploadBatchId == batchId.Value) : query;
        }

        [HttpGet("fix/summary")]
        public async Task<IActionResult> GetFixSummary([FromQuery] Guid? batchId)
        {
            var query = RowsToFix(batchId);

            var typeValues = await query.Where(q => q.IsTypeDisputed)
                .GroupBy(q => q.QuestionType ?? "")
                .Select(g => new DisputedValueCountDto { Value = g.Key, Count = g.Count() })
                .OrderByDescending(v => v.Count)
                .ToListAsync();

            var partValues = await query.Where(q => q.IsPartDisputed)
                .GroupBy(q => q.QuestionPart ?? "")
                .Select(g => new DisputedValueCountDto { Value = g.Key, Count = g.Count() })
                .OrderByDescending(v => v.Count)
                .ToListAsync();

            return Ok(new DisputedSummaryDto
            {
                TotalToFix = await query.CountAsync(),
                ErrorRows = await query.CountAsync(q => q.HasError),
                TotalDisputed = await query.CountAsync(q => q.IsTypeDisputed || q.IsPartDisputed),
                TypeDisputed = typeValues.Sum(v => v.Count),
                PartDisputed = partValues.Sum(v => v.Count),
                TypeValues = typeValues,
                PartValues = partValues
            });
        }

        // problem: "Error" | "Disputed" | "Type" | "Part" | empty for every row that needs fixing;
        // value: a disputed value ("" = empty cell) within Type or Part.
        [HttpGet("fix")]
        public async Task<IActionResult> GetRowsToFix(
            [FromQuery] Guid? batchId,
            [FromQuery] string? problem,
            [FromQuery] string? value,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25)
        {
            var query = RowsToFix(batchId);

            if (string.Equals(problem, "Error", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(q => q.HasError);
            }
            else if (string.Equals(problem, "Disputed", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(q => q.IsTypeDisputed || q.IsPartDisputed);
            }
            else if (string.Equals(problem, "Type", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(q => q.IsTypeDisputed);
                if (value != null) query = value == "" ? query.Where(q => q.QuestionType == null) : query.Where(q => q.QuestionType == value);
            }
            else if (string.Equals(problem, "Part", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(q => q.IsPartDisputed);
                if (value != null) query = value == "" ? query.Where(q => q.QuestionPart == null) : query.Where(q => q.QuestionPart == value);
            }

            return Ok(await PageAsync(ApplySearch(query, search), page, pageSize, orderByUpload: true));
        }

        // Sets Type and/or Part of the selected questions.
        [HttpPost("fix/resolve")]
        public async Task<IActionResult> ResolveDisputes([FromBody] ResolveDisputesDto dto)
        {
            if (dto.Ids == null || dto.Ids.Count == 0)
                return BadRequest(new { message = "Select at least one question." });
            if (dto.QuestionType == null && dto.QuestionPart == null)
                return BadRequest(new { message = "Choose a new Type or Part." });

            var rows = await _context.BulkQuestionsExcel.Where(q => dto.Ids.Contains(q.BulkQuestionId)).ToListAsync();
            return await ApplyResolutionAsync(rows, dto.QuestionType, dto.QuestionPart);
        }

        // Replaces one disputed value everywhere, e.g. every Type "Academic" becomes "Descriptive".
        [HttpPost("fix/resolve-by-value")]
        public async Task<IActionResult> ResolveDisputesByValue([FromBody] ResolveDisputesByValueDto dto)
        {
            bool isType = string.Equals(dto.Column, "Type", StringComparison.OrdinalIgnoreCase);
            bool isPart = string.Equals(dto.Column, "Part", StringComparison.OrdinalIgnoreCase);
            if (!isType && !isPart)
                return BadRequest(new { message = "Column must be Type or Part." });

            var query = _context.BulkQuestionsExcel.AsQueryable();
            if (dto.UploadBatchId.HasValue) query = query.Where(q => q.UploadBatchId == dto.UploadBatchId.Value);

            if (isType)
            {
                query = query.Where(q => q.IsTypeDisputed);
                query = dto.Value == "" ? query.Where(q => q.QuestionType == null) : query.Where(q => q.QuestionType == dto.Value);
            }
            else
            {
                query = query.Where(q => q.IsPartDisputed);
                query = dto.Value == "" ? query.Where(q => q.QuestionPart == null) : query.Where(q => q.QuestionPart == dto.Value);
            }

            var rows = await query.ToListAsync();
            if (rows.Count == 0)
                return NotFound(new { message = "No disputed questions have this value any more." });

            return await ApplyResolutionAsync(rows, isType ? dto.NewValue : null, isPart ? dto.NewValue : null);
        }

        // Replaces every field of one saved question and re-checks it with the upload rules.
        // The edit is saved even when problems remain (they are returned), unless a value is too
        // long for its column.
        [HttpPut("questions/{id:long}")]
        public async Task<IActionResult> UpdateQuestion(long id, [FromBody] UpdateBulkQuestionDto dto)
        {
            var row = await _context.BulkQuestionsExcel.FindAsync(id);
            if (row == null)
                return NotFound(new { message = "Question not found." });

            var edited = new BulkQuestionRowDto
            {
                ExcelRowNo = row.ExcelRowNo,
                Grade = dto.Grade,
                Department = dto.Department,
                JobConcentration = dto.JobConcentration,
                Location = dto.Location,
                QuestionPart = dto.QuestionPart,
                QuestionType = dto.QuestionType,
                Question = dto.Question ?? string.Empty,
                Option1 = dto.Option1,
                Option2 = dto.Option2,
                Option3 = dto.Option3,
                Option4 = dto.Option4,
                RightAnswer = dto.RightAnswer
            };
            var issues = BulkQuestionExcelParser.ValidateQuestion(edited);

            var tooLong = issues.Where(i => i.Code == "TOO_LONG").ToList();
            if (tooLong.Count > 0)
                return BadRequest(new { message = string.Join(" ", tooLong.Select(i => i.Message)) + " Nothing was saved.", issues });

            bool hadProblem = row.HasError || row.IsTypeDisputed || row.IsPartDisputed;
            var textsBefore = BulkQuestionLookupField.All.ToDictionary(f => f, f => f.GetText(row));

            row.Grade = edited.Grade;
            row.Department = edited.Department;
            row.JobConcentration = edited.JobConcentration;
            row.Location = edited.Location;
            row.QuestionType = edited.QuestionType;
            row.QuestionPart = edited.QuestionPart;
            row.Question = edited.Question;
            row.Option1 = edited.Option1;
            row.Option2 = edited.Option2;
            row.Option3 = edited.Option3;
            row.Option4 = edited.Option4;
            row.RightAnswer = edited.RightAnswer;
            StoreValidation(row, edited, issues, hadProblem);

            // A changed Department/Grade/Location/Concentration text loses its lookup id, then takes
            // the id that text is already mapped to elsewhere, if any.
            var changedFields = BulkQuestionLookupField.All
                .Where(f => !string.Equals(textsBefore[f], f.GetText(row), StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (changedFields.Count > 0)
            {
                changedFields.ForEach(f => f.SetId(row, null));
                await BulkQuestionLookupField.ApplyKnownMappingsAsync(_context, new[] { row });
            }

            // A fixed row may now repeat a question that is already saved for the same criteria.
            var duplicates = await MarkDuplicatesAsync(new[] { row });
            if (duplicates.TryGetValue(row.BulkQuestionId, out var duplicateMessage))
            {
                issues.Add(new BulkQuestionIssueDto
                {
                    RowNo = row.ExcelRowNo, Column = "Question", Severity = "Warning", Code = "DUPLICATE", Message = duplicateMessage + DeleteDuplicateHint
                });
            }

            await _context.SaveChangesAsync();

            bool isFixed = !row.HasError && !row.IsTypeDisputed && !row.IsPartDisputed;
            await LogAsync(GetCurrentUserId(), "BULK_QUESTION_EDIT",
                $"Edited question #{id} (row {row.ExcelRowNo} of '{row.FileName}'){(isFixed ? "; it is now valid" : "; problems remain")}.",
                JsonSerializer.Serialize(new { bulkQuestionId = id, row.FileName, row.ExcelRowNo, isFixed, row.HasError, row.IsTypeDisputed, row.IsPartDisputed }));

            return Ok(new UpdateBulkQuestionResultDto
            {
                Row = ToRowDto(row),
                Issues = issues,
                IsFixed = isFixed,
                Message = isFixed
                    ? $"Row {row.ExcelRowNo} of '{row.FileName}' is fixed."
                    : $"Row {row.ExcelRowNo} of '{row.FileName}' was saved, but still needs fixing."
            });
        }

        // Deletes one question (e.g. a row that cannot be fixed).
        [HttpDelete("questions/{id:long}")]
        public async Task<IActionResult> DeleteQuestion(long id)
        {
            var row = await _context.BulkQuestionsExcel.FindAsync(id);
            if (row == null)
                return NotFound(new { message = "Question not found." });

            _context.BulkQuestionsExcel.Remove(row);
            await _context.SaveChangesAsync();

            await LogAsync(GetCurrentUserId(), "BULK_QUESTION_DELETE_ROW",
                $"Deleted question #{id} (row {row.ExcelRowNo} of '{row.FileName}') from the uploaded question bank.",
                JsonSerializer.Serialize(new { bulkQuestionId = id, row.FileName, row.ExcelRowNo, row.QuestionType, row.QuestionPart, row.HasError }));

            return Ok(new { message = $"Deleted row {row.ExcelRowNo} of '{row.FileName}'." });
        }

        // Deletes the selected questions.
        [HttpPost("questions/delete")]
        public async Task<IActionResult> DeleteQuestions([FromBody] DeleteBulkQuestionsDto dto)
        {
            if (dto.Ids == null || dto.Ids.Count == 0)
                return BadRequest(new { message = "Select at least one question." });

            var deleted = await _context.BulkQuestionsExcel
                .Where(q => dto.Ids.Contains(q.BulkQuestionId))
                .ExecuteDeleteAsync();

            await LogAsync(GetCurrentUserId(), "BULK_QUESTION_DELETE_ROWS",
                $"Deleted {deleted} question(s) from the uploaded question bank.",
                JsonSerializer.Serialize(new { ids = dto.Ids, deleted }));

            return Ok(new { message = $"Deleted {deleted} question(s).", deleted });
        }

        private async Task<IActionResult> ApplyResolutionAsync(List<BulkQuestionExcel> rows, string? newType, string? newPart)
        {
            string? type = null, part = null;
            if (newType != null)
            {
                type = BulkQuestionExcelParser.NormalizeQuestionType(newType);
                if (type == null) return BadRequest(new { message = "Type must be MCQ or Descriptive." });
            }
            if (newPart != null)
            {
                part = BulkQuestionExcelParser.NormalizeQuestionPart(newPart);
                if (part == null) return BadRequest(new { message = "Part must be 1, 2 or 3." });
            }

            var result = new ResolveDisputesResultDto();
            var changedRows = new List<BulkQuestionExcel>();

            foreach (var row in rows)
            {
                bool changed = false;
                bool hadProblem = row.HasError || row.IsTypeDisputed || row.IsPartDisputed;

                if (type != null && row.IsTypeDisputed)
                {
                    if (type == BulkQuestionExcelParser.TypeMcq)
                    {
                        var problems = BulkQuestionExcelParser.ValidateMcq(
                            new[] { row.Option1, row.Option2, row.Option3, row.Option4 }, row.RightAnswer, out _);
                        if (problems.Count > 0)
                        {
                            result.Failed.Add(new ResolveFailureDto
                            {
                                BulkQuestionId = row.BulkQuestionId,
                                ExcelRowNo = row.ExcelRowNo,
                                FileName = row.FileName,
                                Reason = "Cannot be MCQ: " + string.Join(" ", problems) + " Use Edit to correct the options and answer."
                            });
                            continue;
                        }
                    }

                    row.QuestionType = type;
                    changed = true;
                }

                if (part != null && row.IsPartDisputed)
                {
                    row.QuestionPart = part;
                    changed = true;
                }

                if (!changed) continue;

                // Re-check the whole row: sets the disputed flags, converts a letter MCQ answer and
                // refreshes the stored errors.
                var dto = ToRowDto(row);
                var issues = BulkQuestionExcelParser.ValidateQuestion(dto);
                row.RightAnswer = dto.RightAnswer;
                StoreValidation(row, dto, issues, hadProblem);
                changedRows.Add(row);
                result.Updated++;
            }

            // A new Part (or Type fix) may make a row repeat a question that is already saved.
            var duplicates = await MarkDuplicatesAsync(changedRows);
            foreach (var row in changedRows.Where(r => duplicates.ContainsKey(r.BulkQuestionId)))
            {
                result.Duplicates.Add(new ResolveFailureDto
                {
                    BulkQuestionId = row.BulkQuestionId,
                    ExcelRowNo = row.ExcelRowNo,
                    FileName = row.FileName,
                    Reason = duplicates[row.BulkQuestionId] + DeleteDuplicateHint
                });
            }

            await _context.SaveChangesAsync();

            if (result.Updated > 0)
            {
                await LogAsync(GetCurrentUserId(), "BULK_QUESTION_DISPUTE_RESOLVE",
                    $"Fixed {result.Updated} disputed question(s)" +
                    (type != null ? $", Type set to {type}" : "") + (part != null ? $", Part set to {part}" : "") + ".",
                    JsonSerializer.Serialize(new { updated = result.Updated, failed = result.Failed.Count, duplicates = result.Duplicates.Count, type, part }));
            }

            result.Message = $"{result.Updated} question(s) updated";
            if (result.Failed.Count > 0) result.Message += $"; {result.Failed.Count} could not be changed";
            if (result.Duplicates.Count > 0) result.Message += $"; {result.Duplicates.Count} now repeat a saved question and were marked as duplicates (delete them if they are not needed)";
            result.Message += ".";
            return Ok(result);
        }

        // Checks rows that were just changed (not saved yet) against the saved questions and against
        // each other, and sets IsDuplicate. A row is a duplicate when another row without errors has
        // the same question, part, grade, department, concentration and location; among the changed
        // rows themselves, the earlier upload counts as the original. Rows with errors take no part.
        // Returns a message per duplicate row, keyed by BulkQuestionId.
        private async Task<Dictionary<long, string>> MarkDuplicatesAsync(IReadOnlyCollection<BulkQuestionExcel> rows)
        {
            var messages = new Dictionary<long, string>();
            foreach (var row in rows) row.IsDuplicate = false;

            var candidates = rows.Where(r => !r.HasError && r.Question.Length > 0).ToList();
            if (candidates.Count == 0) return messages;

            static string Key(string question, string? part, string? grade, string? department, string? concentration, string? location) =>
                BulkQuestionExcelParser.BuildDuplicateKey(question, part, grade, department, concentration, location);

            // Saved rows (other than the changed ones) with the same question text. Question text
            // equality in SQL (case-insensitive collation), in chunks: SQL Server allows 2100 parameters.
            var changedIds = rows.Select(r => r.BulkQuestionId).ToHashSet();
            var originals = new Dictionary<string, (string FileName, int ExcelRowNo)>();
            foreach (var chunk in candidates.Select(r => r.Question).Distinct().Chunk(1000))
            {
                var found = await _context.BulkQuestionsExcel
                    .AsNoTracking()
                    .Where(q => !q.HasError && chunk.Contains(q.Question))
                    .OrderBy(q => q.UploadedAt).ThenBy(q => q.BulkQuestionId)
                    .Select(q => new { q.BulkQuestionId, q.Question, q.QuestionPart, q.Grade, q.Department, q.JobConcentration, q.Location, q.FileName, q.ExcelRowNo })
                    .ToListAsync();
                foreach (var f in found.Where(f => !changedIds.Contains(f.BulkQuestionId)))
                    originals.TryAdd(Key(f.Question, f.QuestionPart, f.Grade, f.Department, f.JobConcentration, f.Location), (f.FileName, f.ExcelRowNo));
            }

            foreach (var row in candidates.OrderBy(r => r.UploadedAt).ThenBy(r => r.BulkQuestionId))
            {
                var key = Key(row.Question, row.QuestionPart, row.Grade, row.Department, row.JobConcentration, row.Location);
                if (originals.TryGetValue(key, out var match))
                {
                    row.IsDuplicate = true;
                    messages[row.BulkQuestionId] =
                        $"The same question with the same part, grade, department, concentration and location is already saved (row {match.ExcelRowNo} of '{match.FileName}').";
                }
                else
                {
                    originals[key] = (row.FileName, row.ExcelRowNo);
                }
            }

            return messages;
        }

        // Stores the outcome of BulkQuestionExcelParser.ValidateQuestion on a saved row and records
        // who fixed it when a row that needed fixing becomes valid.
        private void StoreValidation(BulkQuestionExcel row, BulkQuestionRowDto validated, List<BulkQuestionIssueDto> issues, bool hadProblem)
        {
            if (validated.IsTypeDisputed && !row.IsTypeDisputed) row.OriginalQuestionType ??= validated.QuestionType;
            if (validated.IsPartDisputed && !row.IsPartDisputed) row.OriginalQuestionPart ??= validated.QuestionPart;

            row.IsTypeDisputed = validated.IsTypeDisputed;
            row.IsPartDisputed = validated.IsPartDisputed;
            row.HasError = validated.HasError;
            var errors = issues.Where(i => i.Severity == "Error").Select(i => i.Message).ToList();
            row.ErrorMessages = errors.Count > 0 ? string.Join("\n", errors) : null;

            if (hadProblem && !row.HasError && !row.IsTypeDisputed && !row.IsPartDisputed)
            {
                var userId = GetCurrentUserId();
                row.DisputeResolvedBy = userId > 0 ? userId : null;
                row.DisputeResolvedAt = DateTime.Now;
            }
        }

        #endregion

        #region Helpers

        private static IQueryable<BulkQuestionExcel> ApplySearch(IQueryable<BulkQuestionExcel> query, string? search)
        {
            if (string.IsNullOrWhiteSpace(search)) return query;

            var s = search.Trim();
            return query.Where(q =>
                q.Question.Contains(s) ||
                (q.Grade != null && q.Grade.Contains(s)) ||
                (q.Department != null && q.Department.Contains(s)) ||
                (q.JobConcentration != null && q.JobConcentration.Contains(s)) ||
                (q.Location != null && q.Location.Contains(s)));
        }

        private static async Task<BulkQuestionRowPageDto> PageAsync(IQueryable<BulkQuestionExcel> query, int page, int pageSize, bool orderByUpload = false)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var ordered = orderByUpload
                ? query.OrderByDescending(q => q.UploadedAt).ThenBy(q => q.ExcelRowNo)
                : query.OrderBy(q => q.ExcelRowNo);

            var total = await query.CountAsync();
            var items = await ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new BulkQuestionRowPageDto { Total = total, Page = page, PageSize = pageSize, Items = items.Select(ToRowDto).ToList() };
        }

        internal static BulkQuestionRowDto ToRowDto(BulkQuestionExcel q) => new()
        {
            BulkQuestionId = q.BulkQuestionId,
            UploadBatchId = q.UploadBatchId,
            FileName = q.FileName,
            ExcelRowNo = q.ExcelRowNo,
            Grade = q.Grade,
            Department = q.Department,
            JobConcentration = q.JobConcentration,
            Location = q.Location,
            DepartmentId = q.DepartmentId,
            GradeId = q.GradeId,
            LocationId = q.LocationId,
            ConcentrationId = q.ConcentrationId,
            QuestionPart = q.QuestionPart,
            QuestionType = q.QuestionType,
            Question = q.Question,
            Option1 = q.Option1,
            Option2 = q.Option2,
            Option3 = q.Option3,
            Option4 = q.Option4,
            RightAnswer = q.RightAnswer,
            IsMcq = q.QuestionType == BulkQuestionExcelParser.TypeMcq,
            IsTypeDisputed = q.IsTypeDisputed,
            IsPartDisputed = q.IsPartDisputed,
            OriginalQuestionType = q.OriginalQuestionType,
            OriginalQuestionPart = q.OriginalQuestionPart,
            HasError = q.HasError,
            Errors = string.IsNullOrEmpty(q.ErrorMessages) ? new List<string>() : q.ErrorMessages.Split('\n').ToList(),
            IsDuplicate = q.IsDuplicate,
            UploadedAt = q.UploadedAt
        };

        private async Task<Dictionary<long, string>> GetUserNamesAsync(IEnumerable<long> ids)
        {
            var list = ids.Distinct().ToList();
            return await _context.SysUserRegistrations
                .Where(u => list.Contains(u.HRRecordId))
                .ToDictionaryAsync(u => u.HRRecordId, u => u.Name ?? u.LoginId);
        }

        private async Task<(BulkQuestionValidationResultDto? result, string? fileHash, IActionResult? error)> ReadAndValidateAsync(IFormFile? file, string? sheetName)
        {
            file ??= Request.HasFormContentType ? Request.Form.Files.FirstOrDefault() : null;

            if (file == null || file.Length == 0)
                return (null, null, BadRequest(new { message = "No file selected, or the file is empty." }));

            if (file.Length > MaxFileBytes)
                return (null, null, BadRequest(new { message = $"The file is larger than {MaxFileBytes / (1024 * 1024)} MB." }));

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
                return (null, null, BadRequest(new { message = "Only Excel files (.xlsx or .xls) can be uploaded." }));

            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);

            var fileHash = Convert.ToHexString(SHA256.HashData(stream.ToArray()));
            stream.Position = 0;

            var fileName = Path.GetFileName(file.FileName);
            if (fileName.Length > 260) fileName = fileName[..260];

            var result = BulkQuestionExcelParser.Parse(stream, fileName, sheetName);
            await MarkDuplicatesOfSavedQuestionsAsync(result);

            return (result, fileHash, null);
        }

        // Flags rows that repeat a question already saved from an earlier upload with the same
        // part, grade, department, concentration and location. Rows already flagged as a duplicate of
        // another row in this file keep that flag.
        private async Task MarkDuplicatesOfSavedQuestionsAsync(BulkQuestionValidationResultDto result)
        {
            var candidates = result.Rows.Where(r => !r.HasError && !r.DuplicateOfRowNo.HasValue && r.Question.Length > 0).ToList();
            if (candidates.Count > 0)
            {
                // Question text equality in SQL (case-insensitive collation); criteria are compared in memory.
                // Queried in chunks: each question becomes one SQL parameter and SQL Server allows 2100.
                var existing = new List<(long BulkQuestionId, string Question, string? QuestionPart, string? Grade, string? Department, string? JobConcentration, string? Location, string FileName, DateTime UploadedAt)>();
                foreach (var chunk in candidates.Select(r => r.Question).Distinct().Chunk(1000))
                {
                    var found = await _context.BulkQuestionsExcel
                        .Where(q => !q.HasError && chunk.Contains(q.Question))
                        .Select(q => new { q.BulkQuestionId, q.Question, q.QuestionPart, q.Grade, q.Department, q.JobConcentration, q.Location, q.FileName, q.UploadedAt })
                        .ToListAsync();
                    existing.AddRange(found.Select(e => (e.BulkQuestionId, e.Question, e.QuestionPart, e.Grade, e.Department, e.JobConcentration, e.Location, e.FileName, e.UploadedAt)));
                }

                var byKey = existing
                    .GroupBy(e => BulkQuestionExcelParser.BuildDuplicateKey(e.Question, e.QuestionPart, e.Grade, e.Department, e.JobConcentration, e.Location))
                    .ToDictionary(g => g.Key, g => g.OrderBy(e => e.UploadedAt).First());

                foreach (var row in candidates)
                {
                    if (!byKey.TryGetValue(BulkQuestionExcelParser.BuildDuplicateKey(row), out var match)) continue;

                    row.DuplicateOfBulkQuestionId = match.BulkQuestionId;
                    row.DuplicateOfFileName = match.FileName;
                    row.DuplicateOfUploadedAt = match.UploadedAt;
                    result.Issues.Add(new BulkQuestionIssueDto
                    {
                        RowNo = row.ExcelRowNo,
                        Column = "Question",
                        Severity = "Warning",
                        Code = "DUPLICATE",
                        Message = $"Already saved from '{match.FileName}' ({match.UploadedAt:dd MMM yyyy}) with the same part, grade, department, concentration and location."
                    });
                    result.WarningCount++;
                }
            }

            result.DuplicateCount = result.Rows.Count(r => !r.HasError && IsDuplicateRow(r));
        }

        private async Task LogAsync(long userId, string action, string description, string detailsJson)
        {
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

        #endregion
    }
}
