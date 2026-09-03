using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Question_Bank")]
    public class QuestionBank
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int QuestionId { get; set; }

        public int SetId { get; set; }
        public int TypeId { get; set; } // 1 = MCQ, 2 = Narrative
        public int? CategoryId { get; set; }

        [Required]
        public string Question { get; set; } = string.Empty;

        public string? NarrativeAnswer { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Marks { get; set; }

        public int? LastExamYear { get; set; }
        public bool? IsUpdate { get; set; }
        public bool? IsActive { get; set; }
        public int? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }

        [ForeignKey("SetId")]
        public virtual QuestionSet? QuestionSet { get; set; }

        public virtual ICollection<QuestionBankAnswer> Answers { get; set; } = new List<QuestionBankAnswer>();
    }
}
