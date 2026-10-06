using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    // One question row of an uploaded Question Bank Excel file (reference layout: QB.xlsx).
    // Text values are stored cleaned but otherwise as submitted.
    //
    // Question Type must be MCQ or Descriptive and Question Part must be 1, 2 or 3. A row with any
    // other value is still saved but flagged as disputed (IsTypeDisputed / IsPartDisputed) and keeps
    // the value from the file in Original*.
    //
    // A row that fails validation (e.g. empty question, MCQ without a valid answer) is also saved,
    // flagged with HasError and the error messages, so it can be corrected instead of re-uploaded.
    // Disputed and error rows are corrected in Question Bank > Fix Questions.
    [Table("Bulk_Questions_Excel")]
    public class BulkQuestionExcel
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long BulkQuestionId { get; set; }

        // All rows saved from one uploaded file share the same UploadBatchId.
        public Guid UploadBatchId { get; set; }

        [Required]
        [StringLength(260)]
        public string FileName { get; set; } = string.Empty;

        [StringLength(100)]
        public string? SheetName { get; set; }

        [StringLength(64)]
        public string? FileHash { get; set; }

        // 1-based row number in the Excel sheet, for tracing a record back to the file.
        public int ExcelRowNo { get; set; }

        [StringLength(100)]
        public string? Grade { get; set; }

        [StringLength(200)]
        public string? Department { get; set; }

        [StringLength(200)]
        public string? JobConcentration { get; set; }

        [StringLength(200)]
        public string? Location { get; set; }

        // Sys_Lookup ids of the Department, Grade, Location and Concentration text above, set in
        // Question Bank > Lookup Mapping (null = not mapped yet).
        public int? DepartmentId { get; set; }
        public int? GradeId { get; set; }
        public int? LocationId { get; set; }
        public int? ConcentrationId { get; set; }

        [StringLength(50)]
        public string? QuestionPart { get; set; }

        [StringLength(100)]
        public string? QuestionType { get; set; }

        [Required]
        public string Question { get; set; } = string.Empty;

        public string? Option1 { get; set; }
        public string? Option2 { get; set; }
        public string? Option3 { get; set; }
        public string? Option4 { get; set; }
        public string? RightAnswer { get; set; }

        public bool IsTypeDisputed { get; set; }
        public bool IsPartDisputed { get; set; }

        [StringLength(100)]
        public string? OriginalQuestionType { get; set; }

        [StringLength(50)]
        public string? OriginalQuestionPart { get; set; }

        public bool HasError { get; set; }

        // Validation errors of the row, one per line; null when the row has no errors.
        public string? ErrorMessages { get; set; }

        // Who fixed the row and when: set when a disputed or error row becomes valid.
        public long? DisputeResolvedBy { get; set; }
        public DateTime? DisputeResolvedAt { get; set; }

        // The same question with the same grade/department/concentration/location already existed
        // and the uploader chose to keep this copy.
        public bool IsDuplicate { get; set; }

        public long? UploadedBy { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.Now;
    }
}
