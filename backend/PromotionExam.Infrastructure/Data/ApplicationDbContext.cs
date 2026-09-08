using Microsoft.EntityFrameworkCore;
using PromotionExam.Domain.Entities;

namespace PromotionExam.Infrastructure.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<SysUserRegistration> SysUserRegistrations => Set<SysUserRegistration>();
        public DbSet<SysLookupType> SysLookupTypes => Set<SysLookupType>();
        public DbSet<SysLookup> SysLookups => Set<SysLookup>();
        public DbSet<SysMenu> SysMenus => Set<SysMenu>();
        public DbSet<QuestionSet> QuestionSets => Set<QuestionSet>();
        public DbSet<QuestionBank> QuestionBanks => Set<QuestionBank>();
        public DbSet<QuestionBankAnswer> QuestionBankAnswers => Set<QuestionBankAnswer>();
        public DbSet<ExamBatch> ExamBatches => Set<ExamBatch>();
        public DbSet<SysFlowpath> SysFlowpaths => Set<SysFlowpath>();
        public DbSet<ExamRegistration> ExamRegistrations => Set<ExamRegistration>();
        public DbSet<ExamQuestionSheet> ExamQuestionSheets => Set<ExamQuestionSheet>();
        public DbSet<ExamAnswerSheet> ExamAnswerSheets => Set<ExamAnswerSheet>();
        public DbSet<ExamNarrativeScore> ExamNarrativeScores => Set<ExamNarrativeScore>();
        public DbSet<AiRubricMaster> AiRubricMasters => Set<AiRubricMaster>();
        public DbSet<ExamNarrativeAiEvaluation> ExamNarrativeAiEvaluations => Set<ExamNarrativeAiEvaluation>();
        public DbSet<SysUserActivityLog> SysUserActivityLogs => Set<SysUserActivityLog>();
        public DbSet<SysCompanyConfig> SysCompanyConfigs => Set<SysCompanyConfig>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<SysUserRegistration>(entity =>
            {
                entity.HasKey(e => e.HRRecordId);
            });

            modelBuilder.Entity<SysLookupType>(entity =>
            {
                entity.HasKey(e => e.TypeId);
            });

            modelBuilder.Entity<SysLookup>(entity =>
            {
                entity.HasKey(e => e.LookupId);
                entity.HasOne(e => e.LookupType)
                      .WithMany()
                      .HasForeignKey(e => e.TypeId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<SysMenu>(entity =>
            {
                entity.HasKey(e => e.id);
            });

            modelBuilder.Entity<QuestionSet>(entity =>
            {
                entity.HasKey(e => e.SetId);
            });

            modelBuilder.Entity<QuestionBank>(entity =>
            {
                entity.HasKey(e => e.QuestionId);
                entity.HasOne(e => e.QuestionSet)
                      .WithMany()
                      .HasForeignKey(e => e.SetId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<QuestionBankAnswer>(entity =>
            {
                entity.HasKey(e => e.AnswerId);
                entity.HasOne(e => e.QuestionBank)
                      .WithMany(q => q.Answers)
                      .HasForeignKey(e => e.QuestionId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ExamBatch>(entity =>
            {
                entity.HasKey(e => e.BatchId);
            });

            modelBuilder.Entity<SysFlowpath>(entity =>
            {
                entity.HasKey(e => e.Path_Id);
            });

            modelBuilder.Entity<ExamRegistration>(entity =>
            {
                entity.HasKey(e => e.ExamineeId);
                entity.HasOne(e => e.User)
                      .WithMany()
                      .HasForeignKey(e => e.HRRecordId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.Batch)
                      .WithMany()
                      .HasForeignKey(e => e.BatchId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.QuestionSet)
                      .WithMany()
                      .HasForeignKey(e => e.QuestionSetId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ExamQuestionSheet>(entity =>
            {
                entity.HasKey(e => e.EQS_Id);
                entity.HasOne(e => e.Question)
                      .WithMany()
                      .HasForeignKey(e => e.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ExamAnswerSheet>(entity =>
            {
                entity.HasKey(e => e.EAS_Id);
                entity.HasOne(e => e.Question)
                      .WithMany()
                      .HasForeignKey(e => e.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ExamNarrativeScore>(entity =>
            {
                entity.HasKey(e => e.ScoreId);
                entity.HasOne(e => e.Question)
                      .WithMany()
                      .HasForeignKey(e => e.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AiRubricMaster>(entity =>
            {
                entity.HasKey(e => e.RubricMasterId);
                entity.HasIndex(e => new { e.QuestionId, e.VersionNo }).IsUnique();
                entity.HasOne(e => e.Question)
                      .WithMany()
                      .HasForeignKey(e => e.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ExamNarrativeAiEvaluation>(entity =>
            {
                entity.HasKey(e => e.AiEvaluationId);
                entity.HasIndex(e => new { e.ExamineeId, e.QuestionId, e.RubricMasterId }).IsUnique();
                entity.HasOne(e => e.Question)
                      .WithMany()
                      .HasForeignKey(e => e.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.RubricMaster)
                      .WithMany()
                      .HasForeignKey(e => e.RubricMasterId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<SysUserActivityLog>(entity =>
            {
                entity.HasKey(e => e.ActivityId);
                entity.HasOne(e => e.User)
                      .WithMany()
                      .HasForeignKey(e => e.HRRecordId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<SysCompanyConfig>(entity =>
            {
                entity.HasKey(e => e.ConfigId);
            });
        }
    }
}
