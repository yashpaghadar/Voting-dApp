import React from 'react';
import { Link } from 'react-router-dom';
import { FaVoteYea, FaMedal, FaTrophy, FaAward, FaArrowLeft } from 'react-icons/fa';
import './HowItWorks.css';

const HowItWorks = () => {
  return (
    <div className="how-it-works">
      <div className="nav-buttons">
        <Link to="/my-nfts" className="back-button">
          <FaArrowLeft className="back-icon" /> Back to NFT Gallery
        </Link>
      </div>
      
      <div className="how-it-works-container">
        <header className="how-it-works-header">
          <h1 style={{fontSize:'3rem'}}>How Voting Badges Work</h1>
          <p className="subtitle">Earn special badges by participating in the governance process</p>
        </header>

        <section className="badge-system">
          <div className="badge-system-intro">
            <h2>The Badge System</h2>
            <p>
              Our voting badge system rewards active participation in the governance process. 
              Each badge represents your contribution and engagement with the community.
            </p>
          </div>

          <div className="badge-types">
            <h2>Types of Badges</h2>
            <div className="badge-cards">
              <div className="badge-card">
                <div className="badge-icon beginner">
                  <FaVoteYea />
                </div>
                <h4>Starter Badge</h4>
                <p>Earned after your first successful vote on any proposal.</p>
              </div>
              
              <div className="badge-card">
                <div className="badge-icon contributor">
                  <FaMedal />
                </div>
                <h4>Contributor Badge</h4>
                <p>Awarded after participating in 5 different proposals.</p>
              </div>
              
              <div className="badge-card">
                <div className="badge-icon influencer">
                  <FaTrophy />
                </div>
                <h4>Influencer Badge</h4>
                <p>For users whose votes have helped pass important proposals.</p>
              </div>
              
              <div className="badge-card">
                <div className="badge-icon legend">
                  <FaAward />
                </div>
                <h4>Legend Badge</h4>
                <p>Awarded to top contributors who consistently participate in governance.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="how-to-earn">
          <h2>How to Earn Badges</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Connect Your Wallet</h3>
                <p>Connect your Web3 wallet to the platform to start participating.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Vote on Proposals</h3>
                <p>Participate in active governance proposals by casting your vote.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Earn Badges</h3>
                <p>Collect badges automatically as you reach participation milestones.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Showcase Your Collection</h3>
                <p>Display your badge collection and governance participation history.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="benefits">
          <h2>Benefits of Badges</h2>
          <div className="benefits-grid">
            <div className="benefit">
              <h3>Recognition</h3>
              <p>Show your commitment to the community's growth and development.</p>
            </div>
            
            <div className="benefit">
              <h3>Exclusive Access</h3>
              <p>Gain access to special features and early proposal previews.</p>
            </div>
            
            <div className="benefit">
              <h3>Governance Power</h3>
              <p>Higher-tier badges may come with additional voting power in the future.</p>
            </div>
          </div>
        </section>

        <section className="faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-item">
            <h3>How do I know if I've earned a badge?</h3>
            <p>You'll receive a notification when you earn a new badge, and it will appear in your NFT collection.</p>
          </div>
          
          <div className="faq-item">
            <h3>Can I transfer or sell my badges?</h3>
            <p>Badges are soulbound NFTs, meaning they're non-transferable and permanently linked to your wallet.</p>
          </div>
          
          <div className="faq-item">
            <h3>Do badges expire?</h3>
            <p>No, once you earn a badge, it's yours forever as a record of your participation.</p>
          </div>
        </section>

        <div className="cta-section">
          <h2 style={{color:'white'}}>Ready to Start Earning Badges?</h2>
          <p>Participate in governance and start building your badge collection today.</p>
          <Link to="/vote" className="cta-button">
            View Active Proposals
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
