import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VoteDashboard from './VoteDashboard';
import ErrorBoundary from './ErrorBoundary';
import Welcome from './Welcome';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/vote" element={<ErrorBoundary><VoteDashboard /></ErrorBoundary>} />
        <Route path="/" element={<Welcome />} />
      </Routes>
    </Router>
  );
}

export default App;
