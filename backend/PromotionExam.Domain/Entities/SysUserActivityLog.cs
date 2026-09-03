using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_UserActivityLog")]
    public class SysUserActivityLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long ActivityId { get; set; }

        public long? HRRecordId { get; set; }

        [Required]
        [StringLength(100)]
        public string LoginId { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        public string UserName { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string Role { get; set; } = string.Empty; // SuperAdmin, Admin, Examinee

        [Required]
        [StringLength(50)]
        public string ActivityCategory { get; set; } = string.Empty; // AUTH, EXAM, GRADING, QUESTION, HR, ADMIN

        [Required]
        [StringLength(100)]
        public string ActionName { get; set; } = string.Empty; // LOGIN, START_EXAM, SUBMIT_EXAM, etc.

        [Required]
        [StringLength(1000)]
        public string Description { get; set; } = string.Empty;

        [StringLength(50)]
        public string? IpAddress { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public string? DetailsJson { get; set; }

        [ForeignKey("HRRecordId")]
        public virtual SysUserRegistration? User { get; set; }
    }
}
