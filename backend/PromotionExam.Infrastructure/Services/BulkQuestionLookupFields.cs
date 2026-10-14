using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.Infrastructure.Services
{
    // A text value of a Bulk_Questions_Excel row together with the Sys_Lookup id it is mapped to.
    public class BulkQuestionLookupPair
    {
        public string? Text { get; set; }
        public int? Id { get; set; }
    }

    // The four Bulk_Questions_Excel columns whose text is mapped to a Sys_Lookup id in
    // Question Bank > Lookup Mapping: Department, Grade, Location and JobConcentration.
    // The ids come from the Sys_Lookup items of the lookup type with the same name.
    public sealed class BulkQuestionLookupField
    {
        public string Key { get; }
        public string Label { get; }
        public string LookupType { get; }
        public Expression<Func<BulkQuestionExcel, string?>> Text { get; }
        public Expression<Func<BulkQuestionExcel, int?>> Id { get; }
        public Expression<Func<BulkQuestionExcel, BulkQuestionLookupPair>> Pair { get; }

        private readonly Func<BulkQuestionExcel, string?> _getText;
        private readonly PropertyInfo _idProperty;

        private BulkQuestionLookupField(string key, string label, string lookupType,
            Expression<Func<BulkQuestionExcel, string?>> text, Expression<Func<BulkQuestionExcel, int?>> id,
            Expression<Func<BulkQuestionExcel, BulkQuestionLookupPair>> pair)
        {
            Key = key;
            Label = label;
            LookupType = lookupType;
            Text = text;
            Id = id;
            Pair = pair;
            _getText = text.Compile();
            _idProperty = (PropertyInfo)((MemberExpression)id.Body).Member;
        }

        public string? GetText(BulkQuestionExcel row) => _getText(row);
        public int? GetId(BulkQuestionExcel row) => (int?)_idProperty.GetValue(row);
        public void SetId(BulkQuestionExcel row, int? value) => _idProperty.SetValue(row, value);

        // Rows whose text equals value (SQL comparison, so case-insensitive with the default collation).
        public Expression<Func<BulkQuestionExcel, bool>> TextEquals(string value)
        {
            // A closure keeps the value a SQL parameter instead of an inlined literal.
            Expression<Func<string>> captured = () => value;
            return Expression.Lambda<Func<BulkQuestionExcel, bool>>(
                Expression.Equal(Text.Body, captured.Body), Text.Parameters);
        }

        // Rows mapped to lookupId, or not mapped at all when lookupId is null.
        public Expression<Func<BulkQuestionExcel, bool>> IdEquals(int? lookupId)
        {
            Expression right = lookupId.HasValue
                ? ((Expression<Func<int?>>)(() => lookupId)).Body
                : Expression.Constant(null, typeof(int?));
            return Expression.Lambda<Func<BulkQuestionExcel, bool>>(Expression.Equal(Id.Body, right), Id.Parameters);
        }

        public static readonly BulkQuestionLookupField Department = new("department", "Department", "Department",
            q => q.Department, q => q.DepartmentId, q => new BulkQuestionLookupPair { Text = q.Department, Id = q.DepartmentId });

        public static readonly BulkQuestionLookupField Grade = new("grade", "Grade", "Grade",
            q => q.Grade, q => q.GradeId, q => new BulkQuestionLookupPair { Text = q.Grade, Id = q.GradeId });

        public static readonly BulkQuestionLookupField Location = new("location", "Location", "Location",
            q => q.Location, q => q.LocationId, q => new BulkQuestionLookupPair { Text = q.Location, Id = q.LocationId });

        public static readonly BulkQuestionLookupField Concentration = new("concentration", "Concentration", "Concentration",
            q => q.JobConcentration, q => q.ConcentrationId, q => new BulkQuestionLookupPair { Text = q.JobConcentration, Id = q.ConcentrationId });

        public static readonly IReadOnlyList<BulkQuestionLookupField> All = new[] { Department, Grade, Location, Concentration };

        public static BulkQuestionLookupField? Find(string? key) =>
            All.FirstOrDefault(f => string.Equals(f.Key, key, StringComparison.OrdinalIgnoreCase));

        // New rows reuse the mappings already made: a text value that every mapped saved row maps to
        // the same lookup id gets that id. A value mapped to different ids is left unmapped.
        public static async Task ApplyKnownMappingsAsync(ApplicationDbContext context, IReadOnlyCollection<BulkQuestionExcel> rows)
        {
            foreach (var field in All)
            {
                var texts = rows.Select(field.GetText).Where(t => !string.IsNullOrEmpty(t)).ToHashSet(StringComparer.OrdinalIgnoreCase);
                if (texts.Count == 0) continue;

                var mapped = await context.BulkQuestionsExcel
                    .Select(field.Pair)
                    .Where(p => p.Text != null && p.Id != null)
                    .Distinct()
                    .ToListAsync();

                var known = mapped
                    .Where(p => texts.Contains(p.Text!))
                    .GroupBy(p => p.Text!, StringComparer.OrdinalIgnoreCase)
                    .Where(g => g.Select(p => p.Id).Distinct().Count() == 1)
                    .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

                foreach (var row in rows)
                {
                    var text = field.GetText(row);
                    if (text != null && known.TryGetValue(text, out var id)) field.SetId(row, id);
                }
            }
        }

        // Text equal to a Sys_Lookup item of typeId (ignoring case and extra spaces) gets that item's id,
        // replacing a mapping reused from earlier uploads. Text that still has no id becomes a new active
        // Sys_Lookup item of typeId. Returns the number of items created.
        // The new items are saved here, so call it inside a transaction together with saving the rows.
        public async Task<int> MatchOrCreateLookupsAsync(ApplicationDbContext context, IReadOnlyCollection<BulkQuestionExcel> rows, int typeId, long? userId)
        {
            var withText = rows.Where(r => !string.IsNullOrWhiteSpace(GetText(r))).ToList();
            if (withText.Count == 0) return 0;

            // Without the lookup type there is nothing to match or create; the rows stay as they are.
            if (!await context.SysLookupTypes.AnyAsync(t => t.TypeId == typeId)) return 0;

            var lookups = await context.SysLookups
                .Where(l => l.TypeId == typeId)
                .Select(l => new { l.LookupId, l.LookupText, l.IsActive, l.Serial })
                .ToListAsync();

            // Several items with the same text: the active one with the lowest id is used.
            var idByText = lookups
                .OrderByDescending(l => l.IsActive == true).ThenBy(l => l.LookupId)
                .GroupBy(l => NormalizeText(l.LookupText), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().LookupId, StringComparer.OrdinalIgnoreCase);

            var created = new Dictionary<string, SysLookup>(StringComparer.OrdinalIgnoreCase);
            var serial = lookups.Max(l => l.Serial) ?? 0;
            foreach (var row in withText)
            {
                var text = NormalizeText(GetText(row)!);
                if (idByText.TryGetValue(text, out var id))
                    SetId(row, id);
                else if (GetId(row) == null && !created.ContainsKey(text))
                    created[text] = new SysLookup
                    {
                        TypeId = typeId,
                        LookupText = text,
                        Serial = ++serial,
                        IsActive = true,
                        EntryBy = userId,
                        EntryDate = DateTime.Now
                    };
            }
            if (created.Count == 0) return 0;

            context.SysLookups.AddRange(created.Values);
            await context.SaveChangesAsync();

            foreach (var row in withText)
            {
                if (GetId(row) == null && created.TryGetValue(NormalizeText(GetText(row)!), out var item))
                    SetId(row, item.LookupId);
            }
            return created.Count;
        }

        // Trims and collapses runs of spaces, so " Solar  Energy" matches "Solar Energy".
        private static string NormalizeText(string text) =>
            string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }
}
