import importlib.util, tempfile, unittest
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('enrichment',Path(__file__).parents[1]/'services/enrichment.py')
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
class EnrichmentTests(unittest.TestCase):
    def test_private_redirect_and_dns_rebinding_targets_rejected(self):
        for url,ip in [('http://localhost','127.0.0.1'),('http://tailnet','100.108.203.101'),('http://mixed','10.0.0.1')]:
            with patch.object(e.socket,'getaddrinfo',return_value=[(2,1,6,'',(ip,80))]):
                with self.assertRaises(ValueError):e.public_target(url)
        with self.assertRaises(ValueError):e.public_target('file:///etc/passwd')
        with self.assertRaises(ValueError):e.public_target('http://example.com:8080')
    def test_selection_preserves_existing_and_other_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            old=e.ROOT;e.ROOT=Path(tmp)
            try:
                e.save('job',{'status':'working','total':1,'done':0,'rows':{'1':{'emails':'keep@example.com','status':'old'}}})
                e.BUSY.acquire()
                with patch.object(e,'find_emails',return_value=['new@example.com']):
                    e.work('job',[{'website':'https://example.com','emails':'old@example.com'},{}],[0])
                data=e.read('job');self.assertEqual(data['rows']['1']['emails'],'keep@example.com');self.assertIn('old@example.com',data['rows']['0']['emails']);self.assertIn('new@example.com',data['rows']['0']['emails']);self.assertEqual(data['status'],'done')
            finally:e.ROOT=old
if __name__=='__main__':unittest.main()
