import React from 'react';
import { Link } from 'react-router-dom';
import { FaInfoCircle } from 'react-icons/fa';
import './ProposalModal.css';

const ProposalModal = ({ show, onClose, proposals = [], loading = false }) => {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="proposal-modal">
        <div className="modal-header">
          <h2>All Proposals</h2>
          <button className="close-modal" onClick={onClose}>
            ×
          </button>
        </div>
        {loading ? (
          <div className="loading-proposals">
            <div className="loading-spinner"></div>
            Loading proposals...
          </div>
        ) : (
          <div className="proposal-list">
            {proposals?.length > 0 ? (
              [...proposals]
                .sort((a, b) => {
                  const statusOrder = { 'Open': 0, 'Ended': 1, 'Removed': 2 };
                  const statusA = a.removed ? 'Removed' : 
                               (a.status === 'Ended' || (a.deadline * 1000 < Date.now()) ? 'Ended' : 'Open');
                  const statusB = b.removed ? 'Removed' : 
                               (b.status === 'Ended' || (b.deadline * 1000 < Date.now()) ? 'Ended' : 'Open');
                  
                  if (statusOrder[statusA] !== statusOrder[statusB]) {
                    return statusOrder[statusA] - statusOrder[statusB];
                  }
                  return a.id - b.id;
                })
                .map(proposal => {
                  const status = proposal.removed ? 'Removed' : 
                               (proposal.status === 'Ended' || (proposal.deadline * 1000 < Date.now()) ? 'Ended' : 'Open');
                  
                  return (
                    <div key={proposal.id} className="proposal-item">
                      <span className="proposal-id">Proposal #{proposal.id}</span>
                      <span className="proposal-description" style={{ margin: 0 }}>{proposal.description}</span>
                      <span className="proposal-status" status={status.toLowerCase()}>
                        {status}
                      </span>
                      <Link 
                        to={`/proposal/${proposal.id}`}
                        className="view-details-btn"
                        onClick={onClose}
                      >
                        <FaInfoCircle className="view-details-icon" />
                        View Details
                      </Link>
                    </div>
                  );
                })
            ) : (
              <p>No proposals found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalModal;
