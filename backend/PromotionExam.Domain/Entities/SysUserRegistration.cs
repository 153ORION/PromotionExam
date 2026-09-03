using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_UserRegistration")]
    public class SysUserRegistration
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long HRRecordId { get; set; }

        [Required]
        public string LoginId { get; set; } = string.Empty;

        public string? Password { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Designation { get; set; }
        public string? GradeName { get; set; }
        public string? CompanyName { get; set; }
        public string? DepartmentName { get; set; }
        public string? LocationName { get; set; }
        public string? Email { get; set; }
        public string? Mobile { get; set; }
        public string? ProfilePhotoPath { get; set; }

        public int? CompanyId { get; set; }
        public int? LocationId { get; set; }
        public int? DivisionId { get; set; }
        public int? DepartmentId { get; set; }
        public int? GradeId { get; set; }

        public DateTime? EntryDate { get; set; }
        public DateTime? PasswordUpdateTime { get; set; }

        public bool? IsAdmin { get; set; }
        public bool? IsSuperAdmin { get; set; }
        public bool? IsActive { get; set; }
    }
}
