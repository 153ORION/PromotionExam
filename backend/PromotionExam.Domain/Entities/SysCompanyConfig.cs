using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_CompanyConfiguration")]
    public class SysCompanyConfig
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ConfigId { get; set; }

        [Required]
        [StringLength(200)]
        public string CompanyName { get; set; } = "Orion Group";

        [StringLength(50)]
        public string? CompanyShortName { get; set; } = "OG";

        [StringLength(500)]
        public string? Address { get; set; } = "Orion House, 153-154 Tejgaon I/A, Dhaka-1208, Bangladesh";

        [StringLength(50)]
        public string? Phone { get; set; } = "+880-2-8870133";

        [StringLength(100)]
        public string? Email { get; set; } = "info@orion-group.net";

        [StringLength(200)]
        public string? WebsiteUrl { get; set; } = "https://www.orion-group.net";

        [StringLength(500)]
        public string? LogoUrl { get; set; } = "/uploads/logos/orion_logo.png";

        [StringLength(2000)]
        public string? ExamTermsNotice { get; set; } = "Candidates must adhere strictly to exam time limits and institutional honor code regulations.";

        public string? GeminiApiKey { get; set; }

        public string? OpenAiApiKey { get; set; }

        public DateTime LastUpdatedDate { get; set; } = DateTime.UtcNow;

        [StringLength(100)]
        public string? UpdatedBy { get; set; } = "admin";
    }
}
