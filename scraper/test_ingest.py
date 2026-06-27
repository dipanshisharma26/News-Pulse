import unittest
import sys
import os

# Include parent directory for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ingest import tokenize, parse_date

class TestScraper(unittest.TestCase):
    def test_tokenize(self):
        text = "The quick brown fox jumps over the lazy dog"
        tokens = tokenize(text)
        self.assertIn("quick", tokens)
        self.assertIn("brown", tokens)
        self.assertIn("jumps", tokens)
        # Should exclude common stop words
        self.assertNotIn("the", tokens)
        self.assertNotIn("a", tokens)
        self.assertNotIn("over", tokens)
        
    def test_parse_date(self):
        # RFC 1123 format (common in RSS feeds)
        d1 = parse_date("Thu, 25 Jun 2026 12:00:00 GMT")
        self.assertEqual(d1.year, 2026)
        self.assertEqual(d1.month, 6)
        self.assertEqual(d1.day, 25)
        
        # ISO 8601 format
        d2 = parse_date("2026-06-25T13:45:00Z")
        self.assertEqual(d2.year, 2026)
        self.assertEqual(d2.month, 6)
        self.assertEqual(d2.day, 25)

if __name__ == "__main__":
    unittest.main()
