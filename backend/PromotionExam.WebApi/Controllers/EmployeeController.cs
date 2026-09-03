using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.CandidateAttempt;

namespace PromotionExam.WebApi.Controllers
{
    [ApiController]
    [Route("Api/[controller]/[action]")]
    public class EmployeeController : ControllerBase
    {
        private readonly ICandidateExamService _candidateExamService;

        public EmployeeController(ICandidateExamService candidateExamService)
        {
            _candidateExamService = candidateExamService;
        }

        [HttpGet]
        public async Task<ResponseDTO> getSysUserById(string employeeId)
        {
            return await _candidateExamService.GetSysUserById(employeeId);
        }

        [HttpGet]
        public async Task<ResponseDTO> getSysUsers()
        {
            return await _candidateExamService.GetSysUsers();
        }
    }
}
