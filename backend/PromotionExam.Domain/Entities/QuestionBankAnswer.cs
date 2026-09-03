using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Question_Bank_Answer")]
    public class QuestionBankAnswer
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AnswerId { get; set; }

        public int QuestionId { get; set; }

        [Required]
        public string AnswerDetails { get; set; } = string.Empty;

        public int AnswerSerial { get; set; }
        public int AnswerIsRight { get; set; } // 1 for right, 0 for wrong

        public int? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }

        [ForeignKey("QuestionId")]
        public virtual QuestionBank? QuestionBank { get; set; }
    }
}
