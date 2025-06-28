import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VoteDashboard from './VoteDashboard';
import ErrorBoundary from './ErrorBoundary';
import Welcome from './Welcome';
import ProposalDetail from './ProposalDetail';
import MyVotes from './MyVotes';
import NFTGallery from './components/NFTGallery';
import './App.css';

function App() {
  return (
   

    <Router>
      <main className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/vote" element={<ErrorBoundary><VoteDashboard /></ErrorBoundary>} />
          <Route path="/proposal/:id" element={<ErrorBoundary><ProposalDetail /></ErrorBoundary>} />
          <Route path="/my-votes" element={<ErrorBoundary><MyVotes /></ErrorBoundary>} />
          <Route path="/my-nfts" element={<ErrorBoundary><NFTGallery /></ErrorBoundary>} />
          <Route path="/" element={<Welcome />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
