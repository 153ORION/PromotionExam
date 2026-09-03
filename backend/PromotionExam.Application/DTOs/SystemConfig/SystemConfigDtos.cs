using System;
using System.ComponentModel.DataAnnotations;

namespace PromotionExam.Application.DTOs.SystemConfig
{
    public class SystemConfigDto
    {
        public int ConfigId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string? CompanyShortName { get; set; }
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? WebsiteUrl { get; set; }
        public string? LogoUrl { get; set; }
        public string? ExamTermsNotice { get; set; }
        public DateTime LastUpdatedDate { get; set; }
        public string? UpdatedBy { get; set; }
    }

    public class UpdateSystemConfigRequestDto
    {
        [Required]
        [StringLength(200)]
        public string CompanyName { get; set; } = string.Empty;

        [StringLength(50)]
        public string? CompanyShortName { get; set; }

        [StringLength(500)]
        public string? Address { get; set; }

        [StringLength(50)]
        public string? Phone { get; set; }

        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(200)]
        public string? WebsiteUrl { get; set; }

        [StringLength(500)]
        public string? LogoUrl { get; set; }

        [StringLength(2000)]
        public string? ExamTermsNotice { get; set; }
    }
}
