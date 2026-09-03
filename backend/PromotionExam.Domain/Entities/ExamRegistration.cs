using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Exam_Registration")]
    public class ExamRegistration
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ExamineeId { get; set; }

        public long HRRecordId { get; set; }
        public int BatchId { get; set; }
        public int QuestionSetId { get; set; }
        public int? ExamGradeId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? MCQScore { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? WrittenScore { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalScore { get; set; }

        public DateTime? ExamStart { get; set; }
        public DateTime? ExamEnd { get; set; }
        public bool? IsAttand { get; set; }
        public bool? IsExamEnd { get; set; }
        public bool? IsTimeExpire { get; set; }
        public string? FinalAnswerJson { get; set; }
        public int? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }
        public int? LastUpdateBy { get; set; }
        public DateTime? LastUpdateTime { get; set; }
        public bool? IsActive { get; set; }

        [ForeignKey("HRRecordId")]
        public virtual SysUserRegistration? User { get; set; }

        [ForeignKey("BatchId")]
        public virtual ExamBatch? Batch { get; set; }

        [ForeignKey("QuestionSetId")]
        public virtual QuestionSet? QuestionSet { get; set; }
    }
}
