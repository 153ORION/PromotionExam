namespace PromotionExam.Application.DTOs.Lookups
{
    public class LookupTypeDto
    {
        public int TypeId { get; set; }
        public string LookupType { get; set; } = string.Empty;
        public int? Serial { get; set; }
        public bool? IsActive { get; set; }
        public DateTime? EntryDate { get; set; }
    }

    public class LookupTypeCreateUpdateDto
    {
        public int? TypeId { get; set; }
        public string LookupType { get; set; } = string.Empty;
    }

    public class LookupTypeOverviewDto
    {
        public int Total { get; set; }
        public int Active { get; set; }
        public int InActive { get; set; }
    }

    public class LookupDto
    {
        public int LookupId { get; set; }
        public int TypeId { get; set; }
        public string? TypeName { get; set; }
        public string LookupText { get; set; } = string.Empty;
        public string? LookupTextShort { get; set; }
        public int? Serial { get; set; }
        public bool? IsActive { get; set; }
        public DateTime? EntryDate { get; set; }
    }

    public class LookupCreateUpdateDto
    {
        public int? LookupId { get; set; }
        public int TypeId { get; set; }
        public string LookupText { get; set; } = string.Empty;
        public string? LookupTextShort { get; set; }
    }
}
