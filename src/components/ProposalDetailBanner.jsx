import React from 'react';
import './ProposalDetailBanner.css';
import { FaCrown, FaUser, FaRegClock, FaVoteYea } from 'react-icons/fa';

const ProposalDetailBanner = ({ proposal, id }) => {
  if (!proposal) return null;

  // Determine if the proposal has ended based on deadline
  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= (proposal.deadline || 0);
  
  // Determine status text and color
  let statusText;
  let statusColor;
  
  if (proposal.removed) {
    statusText = 'Removed';
    statusColor = '#95a5a6';
  } else if (proposal.closed) {
    statusText = 'Closed';
    statusColor = '#e74c3c';
  } else if (hasEnded) {
    statusText = 'Ended';
    statusColor = '#f39c12'; // Orange color for ended proposals
  } else {
    statusText = 'Open';
    statusColor = '#2ecc71';
  }

  return (
    <div className="proposal-banner">
      <div className="banner-left">
        <FaCrown className="banner-icon crown" />
        <div className="banner-title">
          <span>Proposal #{id}</span>
          <span className="banner-status" style={{ color: statusColor }}>{statusText}</span>
        </div>
        <div className="banner-desc">Description: {proposal.description}</div>
      </div>
      <div className="banner-right">
        <div className="banner-meta">
          <FaUser className="banner-meta-icon" />
          <span className="banner-meta-label">Creator:</span>
          <span className="banner-meta-value">{proposal.creator}</span>
        </div>
        <div className="banner-meta">
          <FaVoteYea className="banner-meta-icon" />
          <span className="banner-meta-label">Votes:</span>
          <span className="banner-meta-value">{proposal.votes?.toString() || 0}</span>
        </div>
        <div className="banner-meta">
          <FaRegClock className="banner-meta-icon" />
          <span className="banner-meta-label">Deadline:</span>
          <span className="banner-meta-value">{new Date(proposal.deadline * 1000).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default ProposalDetailBanner;
