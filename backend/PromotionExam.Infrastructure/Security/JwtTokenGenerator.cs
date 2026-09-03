using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Domain.Entities;

namespace PromotionExam.Infrastructure.Security
{
    public class JwtTokenGenerator : IJwtTokenGenerator
    {
        private readonly IConfiguration _configuration;

        public JwtTokenGenerator(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GenerateToken(SysUserRegistration user)
        {
            var secret = _configuration["JwtSettings:Secret"] ?? "PromotionExam_SuperSecretKey_2026_SecureAuthenticationToken_CleanArchitecture_Key!";
            var issuer = _configuration["JwtSettings:Issuer"] ?? "PromotionExamCoreAPI";
            var audience = _configuration["JwtSettings:Audience"] ?? "PromotionExamCoreReact";
            var expiryHours = double.TryParse(_configuration["JwtSettings:ExpiryInHours"], out var hours) ? hours : 24;

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)) { KeyId = "PromotionExamKey" };
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.HRRecordId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.HRRecordId.ToString()),
                new Claim(ClaimTypes.Name, user.Name ?? user.LoginId),
                new Claim("LoginId", user.LoginId),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim("CompanyName", user.CompanyName ?? string.Empty),
                new Claim("DepartmentName", user.DepartmentName ?? string.Empty),
                new Claim("Designation", user.Designation ?? string.Empty),
                new Claim("ProfilePhoto", user.ProfilePhotoPath ?? string.Empty),
                new Claim("IsAdmin", (user.IsAdmin == true).ToString()),
                new Claim("IsSuperAdmin", (user.IsSuperAdmin == true).ToString())
            };

            if (user.IsSuperAdmin == true)
            {
                claims.Add(new Claim(ClaimTypes.Role, "SuperAdmin"));
                claims.Add(new Claim(ClaimTypes.Role, "Admin"));
            }
            else if (user.IsAdmin == true)
            {
                claims.Add(new Claim(ClaimTypes.Role, "Admin"));
            }
            else
            {
                claims.Add(new Claim(ClaimTypes.Role, "Examinee"));
            }

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(expiryHours),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
