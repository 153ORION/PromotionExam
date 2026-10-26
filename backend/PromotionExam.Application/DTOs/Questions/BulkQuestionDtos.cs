using System;
using System.Collections.Generic;

namespace PromotionExam.Application.DTOs.Questions
{
    public class BulkQuestionRowDto
    {
        public long? BulkQuestionId { get; set; }
        public Guid? UploadBatchId { get; set; }
        public string? FileName { get; set; }
        public int ExcelRowNo { get; set; }
        public string? Grade { get; set; }
        public string? Department { get; set; }
        public string? JobConcentration { get; set; }
        public string? Location { get; set; }
        // Saved rows: Sys_Lookup ids set in Lookup Mapping.
        public int? DepartmentId { get; set; }
        public int? GradeId { get; set; }
        public int? LocationId { get; set; }
        public int? ConcentrationId { get; set; }
        public string? QuestionPart { get; set; }
        public string? QuestionType { get; set; }
        public string Question { get; set; } = string.Empty;
        public string? Option1 { get; set; }
        public string? Option2 { get; set; }
        public string? Option3 { get; set; }
        public string? Option4 { get; set; }
        public string? RightAnswer { get; set; }
        public bool IsMcq { get; set; }

        // Type is not MCQ/Descriptive, or Part is not 1/2/3: saved, but must be fixed in Fix Questions.
        public bool IsTypeDisputed { get; set; }
        public bool IsPartDisputed { get; set; }
        public string? OriginalQuestionType { get; set; }
        public string? OriginalQuestionPart { get; set; }

        // The row failed validation. It is still saved, and fixed later in Fix Questions.
        public bool HasError { get; set; }
        // Saved rows: the stored error messages.
        public List<string> Errors { get; set; } = new();

        // Duplicate (preview only): same question + grade + department + concentration + location
        // as an earlier row of this file, or as a question already saved from an earlier upload.
        public int? DuplicateOfRowNo { get; set; }
        public long? DuplicateOfBulkQuestionId { get; set; }
        public string? DuplicateOfFileName { get; set; }
        public DateTime? DuplicateOfUploadedAt { get; set; }

        // Saved rows: the user chose to keep this question although it was a duplicate.
        public bool IsDuplicate { get; set; }
        public DateTime? UploadedAt { get; set; }
    }

    public class BulkQuestionIssueDto
    {
        // Excel row number (1-based); null for file-level issues.
        public int? RowNo { get; set; }
        public string? Column { get; set; }
        public string Severity { get; set; } = "Error"; // Error | Warning
        // FILE, MISSING_COLUMN, TOO_LONG, UNREADABLE, EMPTY_QUESTION, INVALID_MCQ, ANSWER_CONVERTED,
        // NO_ANSWER, DISPUTED_TYPE, DISPUTED_PART, DUPLICATE
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class BulkQuestionValidationResultDto
    {
        public string FileName { get; set; } = string.Empty;
        public string? SheetName { get; set; }
        // Sheets of the workbook that have a question header row; the user can pick one.
        public List<string> AvailableSheets { get; set; } = new();
        public int? HeaderRowNo { get; set; }
        public int TotalRows { get; set; }
        public int SkippedEmptyRows { get; set; }
        // Number of cells whose text was cleaned (extra spaces, tabs, line breaks, invisible or garbled characters).
        public int CleanedCellCount { get; set; }
        public int ErrorCount { get; set; }
        public int ErrorRowCount { get; set; }
        public int WarningCount { get; set; }
        public int McqCount { get; set; }
        public int DescriptiveCount { get; set; }
        public int DisputedTypeCount { get; set; }
        public int DisputedPartCount { get; set; }
        public int DuplicateCount { get; set; }
        public bool HasFileError { get; set; }
        public List<string> MissingOptionalColumns { get; set; } = new();
        public List<BulkQuestionIssueDto> Issues { get; set; } = new();
        public List<BulkQuestionRowDto> Rows { get; set; } = new();
    }

    public class BulkQuestionUploadResultDto
    {
        public Guid UploadBatchId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public int SavedRows { get; set; }
        public int SkippedDuplicateRows { get; set; }
        public int KeptDuplicateRows { get; set; }
        public int ErrorRows { get; set; }
        public int DisputedRows { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class BulkQuestionBatchDto
    {
        public Guid UploadBatchId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string? SheetName { get; set; }
        public DateTime UploadedAt { get; set; }
        public long? UploadedBy { get; set; }
        public string? UploadedByName { get; set; }
        public int RowCount { get; set; }
        public int McqCount { get; set; }
        public int DisputedCount { get; set; }
        public int ErrorCount { get; set; }
        public int DuplicateCount { get; set; }
    }

    public class BulkQuestionRowPageDto
    {
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public List<BulkQuestionRowDto> Items { get; set; } = new();
    }

    // ---- Fix Questions (disputed and error rows) ----

    public class DisputedValueCountDto
    {
        // "" stands for an empty cell.
        public string Value { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class DisputedSummaryDto
    {
        // Rows that need fixing: disputed, with errors, or both.
        public int TotalToFix { get; set; }
        public int ErrorRows { get; set; }
        public int TotalDisputed { get; set; }
        public int TypeDisputed { get; set; }
        public int PartDisputed { get; set; }
        public List<DisputedValueCountDto> TypeValues { get; set; } = new();
        public List<DisputedValueCountDto> PartValues { get; set; } = new();
    }

    public class ResolveDisputesDto
    {
        public List<long> Ids { get; set; } = new();
        // New values; null leaves that column unchanged.
        public string? QuestionType { get; set; }
        public string? QuestionPart { get; set; }
    }

    public class ResolveDisputesByValueDto
    {
        public string Column { get; set; } = string.Empty; // "Type" | "Part"
        public string Value { get; set; } = string.Empty;  // current disputed value, "" for empty
        public string NewValue { get; set; } = string.Empty;
        public Guid? UploadBatchId { get; set; }
    }

    public class ResolveFailureDto
    {
        public long BulkQuestionId { get; set; }
        public int ExcelRowNo { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }

    public class ResolveDisputesResultDto
    {
        public int Updated { get; set; }
        public List<ResolveFailureDto> Failed { get; set; } = new();
        // Updated rows that now repeat a saved question; they are saved and marked IsDuplicate.
        public List<ResolveFailureDto> Duplicates { get; set; } = new();
        public string Message { get; set; } = string.Empty;
    }

    // Full edit of one saved row in Fix Questions. Every field is replaced.
    public class UpdateBulkQuestionDto
    {
        public string? Grade { get; set; }
        public string? Department { get; set; }
        public string? JobConcentration { get; set; }
        public string? Location { get; set; }
        public string? QuestionPart { get; set; }
        public string? QuestionType { get; set; }
        public string? Question { get; set; }
        public string? Option1 { get; set; }
        public string? Option2 { get; set; }
        public string? Option3 { get; set; }
        public string? Option4 { get; set; }
        public string? RightAnswer { get; set; }
    }

    // A question typed in on Question Bank > Questions. The lookup ids are optional: an id picked
    // from Sys_Lookup is stored with the question and replaces the matching text with the item's text.
    public class CreateBulkQuestionDto : UpdateBulkQuestionDto
    {
        public int? DepartmentId { get; set; }
        public int? GradeId { get; set; }
        public int? LocationId { get; set; }
        public int? ConcentrationId { get; set; }
    }

    public class UpdateBulkQuestionResultDto
    {
        public BulkQuestionRowDto Row { get; set; } = new();
        // Errors and warnings that remain after the edit.
        public List<BulkQuestionIssueDto> Issues { get; set; } = new();
        // True when the row has no errors and a valid Type and Part.
        public bool IsFixed { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class DeleteBulkQuestionsDto
    {
        public List<long> Ids { get; set; } = new();
    }

    // ---- Lookup Mapping (Department / Grade / Location / Concentration text -> Sys_Lookup id) ----

    public class LookupMappingOptionDto
    {
        public int LookupId { get; set; }
        public string LookupText { get; set; } = string.Empty;
        public string? LookupTextShort { get; set; }
        public bool IsActive { get; set; }
    }

    public class LookupMappingTargetDto
    {
        // null = rows not mapped yet.
        public int? LookupId { get; set; }
        public string? LookupText { get; set; }
        public int RowCount { get; set; }
    }

    // One distinct text value of the field in Bulk_Questions_Excel.
    public class LookupMappingValueDto
    {
        public string Value { get; set; } = string.Empty;
        public int RowCount { get; set; }
        public int UnmappedRowCount { get; set; }
        // How the rows with this value are mapped now; more than one entry = mixed.
        public List<LookupMappingTargetDto> Targets { get; set; } = new();
        // A lookup whose text or short text matches the value (ignoring case, spaces and punctuation).
        public int? SuggestedLookupId { get; set; }
    }

    public class LookupMappingFieldDto
    {
        public string Field { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        // Sys_LookupType.LookupType the ids come from.
        public string LookupType { get; set; } = string.Empty;
        public bool LookupTypeFound { get; set; }
        public List<LookupMappingOptionDto> Options { get; set; } = new();
        public List<LookupMappingValueDto> Values { get; set; } = new();
        // Rows whose text for this field is empty: there is nothing to map.
        public int EmptyRowCount { get; set; }
    }

    public class LookupMappingItemDto
    {
        public string Value { get; set; } = string.Empty;
        // null clears the mapping.
        public int? LookupId { get; set; }
    }

    public class SaveLookupMappingDto
    {
        public List<LookupMappingItemDto> Items { get; set; } = new();
    }

    public class SaveLookupMappingResultDto
    {
        public int UpdatedRows { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
