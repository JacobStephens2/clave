using System;
using System.Collections.Generic;

namespace Clave.Engine
{
    public static class DeterministicRng
    {
        public static double Next(ref uint state)
        {
            unchecked
            {
                state += 0x6d2b79f5u;
                var value = state;
                value = (value ^ (value >> 15)) * (value | 1u);
                value ^= value + (value ^ (value >> 7)) * (value | 61u);
                return (value ^ (value >> 14)) / 4294967296d;
            }
        }

        public static List<T> Shuffle<T>(IEnumerable<T> source, ref uint state)
        {
            var items = new List<T>(source);
            for (var index = items.Count - 1; index > 0; index--)
            {
                var target = (int)Math.Floor(Next(ref state) * (index + 1));
                (items[index], items[target]) = (items[target], items[index]);
            }
            return items;
        }
    }
}
