using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.SystemConfig;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [ApiController]
    [Route("api/system/[controller]")]
    [Route("api/system/config")]
    public class SystemConfigController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IUserActivityService _activityService;
        private readonly ICryptographyService _cryptographyService;
        private readonly IAiMarkingService _aiMarkingService;

        public SystemConfigController(
            ApplicationDbContext context,
            IWebHostEnvironment env,
            IUserActivityService activityService,
            ICryptographyService cryptographyService,
            IAiMarkingService aiMarkingService)
        {
            _context = context;
            _env = env;
            _activityService = activityService;
            _cryptographyService = cryptographyService;
            _aiMarkingService = aiMarkingService;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetConfig()
        {
            var config = await _context.SysCompanyConfigs.OrderBy(c => c.ConfigId).FirstOrDefaultAsync();

            if (config == null)
            {
                config = new SysCompanyConfig
                {
                    CompanyName = "Orion Group",
                    CompanyShortName = "OG",
                    Address = "Orion House, 153-154 Tejgaon I/A, Dhaka-1208, Bangladesh",
                    Phone = "+880-2-8870133",
                    Email = "info@orion-group.net",
                    WebsiteUrl = "https://www.orion-group.net",
                    LogoUrl = "/uploads/logos/default_logo.png",
                    ExamTermsNotice = "Candidates must adhere strictly to exam time limits and institutional honor code regulations.",
                    LastUpdatedDate = DateTime.UtcNow,
                    UpdatedBy = "system"
                };
                _context.SysCompanyConfigs.Add(config);
                await _context.SaveChangesAsync();
            }

            return Ok(new SystemConfigDto
            {
                ConfigId = config.ConfigId,
                CompanyName = config.CompanyName,
                CompanyShortName = config.CompanyShortName,
                Address = config.Address,
                Phone = config.Phone,
                Email = config.Email,
                WebsiteUrl = config.WebsiteUrl,
                LogoUrl = config.LogoUrl,
                ExamTermsNotice = config.ExamTermsNotice,
                HasGeminiApiKey = !string.IsNullOrWhiteSpace(config.GeminiApiKey ?? config.OpenAiApiKey),
                HasOpenAiApiKey = !string.IsNullOrWhiteSpace(config.OpenAiApiKey),
                LastUpdatedDate = config.LastUpdatedDate,
                UpdatedBy = config.UpdatedBy
            });
        }

        [HttpGet("secrets")]
        [Authorize(Roles = "SuperAdmin,Admin")]
        public async Task<IActionResult> GetSecrets()
        {
            var config = await _context.SysCompanyConfigs.OrderBy(c => c.ConfigId).FirstOrDefaultAsync();

            var activeEncryptedKey = config?.GeminiApiKey ?? config?.OpenAiApiKey;
            var decryptedKey = string.IsNullOrWhiteSpace(activeEncryptedKey)
                ? string.Empty
                : _cryptographyService.DecryptLegacy(activeEncryptedKey);

            return Ok(new SystemConfigSecretsDto
            {
                HasGeminiApiKey = !string.IsNullOrWhiteSpace(activeEncryptedKey),
                GeminiApiKey = decryptedKey,
                HasOpenAiApiKey = !string.IsNullOrWhiteSpace(config?.OpenAiApiKey),
                OpenAiApiKey = string.IsNullOrWhiteSpace(config?.OpenAiApiKey)
                    ? string.Empty
                    : _cryptographyService.DecryptLegacy(config!.OpenAiApiKey)
            });
        }

        [HttpPut]
        [Authorize(Roles = "SuperAdmin,Admin")]
        public async Task<IActionResult> UpdateConfig([FromBody] UpdateSystemConfigRequestDto dto)
        {
            var config = await _context.SysCompanyConfigs.OrderBy(c => c.ConfigId).FirstOrDefaultAsync();

            if (config == null)
            {
                config = new SysCompanyConfig();
                _context.SysCompanyConfigs.Add(config);
            }

            config.CompanyName = dto.CompanyName.Trim();
            config.CompanyShortName = dto.CompanyShortName?.Trim();
            config.Address = dto.Address?.Trim();
            config.Phone = dto.Phone?.Trim();
            config.Email = dto.Email?.Trim();
            config.WebsiteUrl = dto.WebsiteUrl?.Trim();
            config.ExamTermsNotice = dto.ExamTermsNotice?.Trim();
            if (!string.IsNullOrWhiteSpace(dto.LogoUrl))
            {
                config.LogoUrl = dto.LogoUrl;
            }
            if (dto.GeminiApiKey != null)
            {
                config.GeminiApiKey = string.IsNullOrWhiteSpace(dto.GeminiApiKey)
                    ? null
                    : _cryptographyService.EncryptLegacy(dto.GeminiApiKey.Trim());
            }
            if (dto.OpenAiApiKey != null)
            {
                config.OpenAiApiKey = string.IsNullOrWhiteSpace(dto.OpenAiApiKey)
                    ? null
                    : _cryptographyService.EncryptLegacy(dto.OpenAiApiKey.Trim());
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            long.TryParse(userIdClaim, out var userId);
            var userName = User.Identity?.Name ?? "Admin";

            config.LastUpdatedDate = DateTime.UtcNow;
            config.UpdatedBy = userName;

            await _context.SaveChangesAsync();

            // Log activity audit
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                userId > 0 ? userId : null,
                userName,
                userName,
                User.IsInRole("SuperAdmin") ? "SuperAdmin" : "Admin",
                "ADMIN",
                "UPDATE_SYSTEM_CONFIG",
                $"Updated institutional profile and company details for '{config.CompanyName}'.",
                ip);

            return Ok(new SystemConfigDto
            {
                ConfigId = config.ConfigId,
                CompanyName = config.CompanyName,
                CompanyShortName = config.CompanyShortName,
                Address = config.Address,
                Phone = config.Phone,
                Email = config.Email,
                WebsiteUrl = config.WebsiteUrl,
                LogoUrl = config.LogoUrl,
                ExamTermsNotice = config.ExamTermsNotice,
                HasGeminiApiKey = !string.IsNullOrWhiteSpace(config.GeminiApiKey ?? config.OpenAiApiKey),
                HasOpenAiApiKey = !string.IsNullOrWhiteSpace(config.OpenAiApiKey),
                LastUpdatedDate = config.LastUpdatedDate,
                UpdatedBy = config.UpdatedBy
            });
        }

        [HttpPost("test-gemini-key")]
        [Authorize(Roles = "SuperAdmin,Admin")]
        public async Task<IActionResult> TestGeminiKey([FromBody] TestGeminiKeyRequestDto? dto)
        {
            var (success, message) = await _aiMarkingService.TestGeminiConnectionAsync(dto?.ApiKey);
            return Ok(new { success, message });
        }

        [HttpPost("upload-logo")]
        [Authorize(Roles = "SuperAdmin,Admin")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadLogo([FromForm] UploadLogoFormDto form)
        {
            var file = form?.File ?? Request.Form.Files.FirstOrDefault();
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded." });

            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { message = "Logo file size cannot exceed 5MB." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".svg", ".webp" };
            if (!allowedExtensions.Contains(ext))
                return BadRequest(new { message = "Only PNG, JPG, JPEG, SVG, and WebP image formats are allowed." });

            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsFolder = Path.Combine(webRoot, "uploads", "logos");

            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = $"logo_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString("N").Substring(0, 8)}{ext}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/uploads/logos/{uniqueFileName}";

            // Update configuration entity
            var config = await _context.SysCompanyConfigs.OrderBy(c => c.ConfigId).FirstOrDefaultAsync();
            if (config != null)
            {
                config.LogoUrl = relativePath;
                config.LastUpdatedDate = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // Log activity audit
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            long.TryParse(userIdClaim, out var userId);
            var userName = User.Identity?.Name ?? "Admin";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            await _activityService.LogAsync(
                userId > 0 ? userId : null,
                userName,
                userName,
                User.IsInRole("SuperAdmin") ? "SuperAdmin" : "Admin",
                "ADMIN",
                "UPLOAD_COMPANY_LOGO",
                $"Uploaded new institutional company logo: '{uniqueFileName}'.",
                ip);

            return Ok(new { logoUrl = relativePath });
        }
    }

    public class UploadLogoFormDto
    {
        public IFormFile? File { get; set; }
    }
}
