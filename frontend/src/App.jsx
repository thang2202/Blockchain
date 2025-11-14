import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Contract addresses (update after deployment)
const ART_TOKEN_ADDRESS = process.env.REACT_APP_ART_TOKEN_ADDRESS;
const AUCTION_ADDRESS = process.env.REACT_APP_AUCTION_ADDRESS;
const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000/api';

// Simple ABI for demonstration (use full ABI from compilation)
const ART_TOKEN_ABI = [
  "function safeMint(address to) public returns (uint256)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) public",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const AUCTION_ABI = [
  "function createAuction(uint256 _tokenId, uint256 _startPrice, uint256 _durationInMinutes) external",
  "function placeBid(uint256 _auctionId) external payable",
  "function endAuction(uint256 _auctionId) external",
  "function getAuctionDetails(uint256 _auctionId) external view returns (tuple(uint256 tokenId, address seller, uint256 startTime, uint256 endTime, uint256 startPrice, address highestBidder, uint256 highestBid, bool ended))",
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address seller, uint256 startPrice, uint256 endTime)",
  "event NewBid(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount)"
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [artTokenContract, setArtTokenContract] = useState(null);
  const [auctionContract, setAuctionContract] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('gallery');

  // Form states
  const [nftForm, setNftForm] = useState({
    name: '',
    description: '',
    image: null
  });
  const [auctionForm, setAuctionForm] = useState({
    tokenId: '',
    startPrice: '',
    duration: ''
  });
  const [bidForm, setBidForm] = useState({
    auctionId: '',
    amount: ''
  });

  useEffect(() => {
    if (account) {
      fetchNFTs();
      fetchActiveAuctions();
    }
  }, [account]);

  const showMessage = (message, type = 'error') => {
    if (type === 'error') {
      setError(message);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(message);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const connectWallet = async () => {
    setLoading(true);
    setError('');
    try {
      if (!window.ethereum) {
        throw new Error('Vui lòng tải MetaMask!');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      
      const web3Signer = await web3Provider.getSigner();
      setSigner(web3Signer);
      
      const userAddress = await web3Signer.getAddress();
      setAccount(userAddress);

      // Initialize contracts
      const artToken = new ethers.Contract(ART_TOKEN_ADDRESS, ART_TOKEN_ABI, web3Signer);
      const auction = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, web3Signer);
      
      setArtTokenContract(artToken);
      setAuctionContract(auction);

      showMessage('Kết nối ví thành công!', 'success');
    } catch (error) {
      console.error('Lỗi kết nối ví:', error);
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNFTs = async () => {
    try {
      const response = await fetch(`${API_BASE}/nfts`);
      if (!response.ok) throw new Error('Không thể lấy NFTs');
      const data = await response.json();
      setNfts(data);
    } catch (error) {
      console.error('Lỗi tải NFTs:', error);
      showMessage('Không thể tải NFTs');
    }
  };

  const fetchActiveAuctions = async () => {
    try {
      const response = await fetch(`${API_BASE}/active-auctions`);
      if (!response.ok) throw new Error('Không thể lấy đấu giá');
      const data = await response.json();
      setAuctions(data);
    } catch (error) {
      console.error('Lỗi tải đấu giá:', error);
      showMessage('Không thể tải đấu giá');
    }
  };

  const createNFT = async (e) => {
    e.preventDefault();
    if (!nftForm.name || !nftForm.image) {
      showMessage('Vui lòng điền tất cả các trường bắt buộc');
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Bắt đầu quá trình tạo NFT...');
      console.log('📝 NFT Data:', nftForm);

      // Upload artwork to backend
      const formData = new FormData();
      formData.append('name', nftForm.name);
      formData.append('description', nftForm.description || '');
      formData.append('artist', 'Digital Artist');
      formData.append('artistAddress', account);
      formData.append('image', nftForm.image);

      console.log('📤 Đang gửi request upload đến backend...');
      
      const uploadResponse = await fetch(`${API_BASE}/upload-artwork`, {
        method: 'POST',
        body: formData
        // Không đặt headers Content-Type, browser sẽ tự động set với FormData
      });

      console.log('📨 Response status:', uploadResponse.status);
      console.log('📨 Response headers:', uploadResponse.headers);

      // Kiểm tra nếu response là HTML (lỗi)
      const contentType = uploadResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await uploadResponse.text();
        console.error('❌ Server trả về HTML thay vì JSON:', textResponse.substring(0, 200));
        
        // Kiểm tra nếu là trang lỗi
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
          throw new Error('Backend server trả về trang lỗi. Kiểm tra server có đang chạy không?');
        } else {
          throw new Error(`Server trả về unexpected response: ${textResponse.substring(0, 100)}`);
        }
      }

      const uploadData = await uploadResponse.json();
      console.log('📊 Upload response data:', uploadData);
      
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || `Tải lên thất bại với status: ${uploadResponse.status}`);
      }

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload không thành công');
      }

      console.log('✅ Upload thành công, đang mint NFT trên blockchain...');

      // Mint NFT on blockchain
      if (!artTokenContract) {
        throw new Error('Contract chưa được khởi tạo');
      }

      const tx = await artTokenContract.safeMint(account);
      console.log('⛓️ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt);

      // Get token ID from event
      const transferEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'Transfer'
      );
      
      let tokenId = '0';
      if (transferEvent) {
        tokenId = transferEvent.args[2].toString();
      } else {
        // Fallback: tìm event Transfer theo interface
        const transferInterface = new ethers.Interface([
          'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
        ]);
        
        for (const log of receipt.logs) {
          try {
            const parsedLog = transferInterface.parseLog(log);
            if (parsedLog && parsedLog.name === 'Transfer') {
              tokenId = parsedLog.args[2].toString();
              break;
            }
          } catch (e) {
            // Bỏ qua log không phải Transfer event
          }
        }
      }

      console.log('🎯 Token ID minted:', tokenId);

      // Save metadata to backend
      console.log('💾 Đang lưu metadata...');
      const saveResponse = await fetch(`${API_BASE}/nft-metadata`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tokenId,
          ...uploadData.metadata,
          imageIpfsHash: uploadData.imageIpfsHash,
          metadataIpfsHash: uploadData.metadataIpfsHash
        })
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        throw new Error(`Lưu siêu dữ liệu thất bại: ${errorText}`);
      }

      const saveData = await saveResponse.json();
      console.log('✅ Metadata saved:', saveData);

      showMessage('Tạo NFT thành công!', 'success');
      setNftForm({ name: '', description: '', image: null });
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
      fetchNFTs();
      
    } catch (error) {
      console.error('❌ Lỗi tạo NFT:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        errorMessage = 'Không thể kết nối đến server backend. Kiểm tra xem server có đang chạy trên port 5000 không?';
      } else if (error.message.includes('IPFS')) {
        errorMessage = 'Lỗi kết nối IPFS. Chắc chắn rằng IPFS daemon đang chạy: ipfs daemon';
      }
      
      showMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createAuction = async (e) => {
    e.preventDefault();
    if (!auctionForm.tokenId || !auctionForm.startPrice || !auctionForm.duration) {
      showMessage('Vui lòng điền tất cả các trường bắt buộc');
      return;
    }

    setLoading(true);
    try {
      const tx = await auctionContract.createAuction(
        auctionForm.tokenId,
        ethers.parseEther(auctionForm.startPrice),
        auctionForm.duration
      );
      await tx.wait();
      
      showMessage('Tạo đấu giá thành công!', 'success');
      setAuctionForm({ tokenId: '', startPrice: '', duration: '' });
      fetchActiveAuctions();
    } catch (error) {
      console.error('Lỗi tạo đấu giá:', error);
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const placeBid = async (e) => {
    e.preventDefault();
    if (!bidForm.auctionId || !bidForm.amount) {
      showMessage('Vui lòng điền tất cả các trường bắt buộc');
      return;
    }

    setLoading(true);
    try {
      const tx = await auctionContract.placeBid(bidForm.auctionId, {
        value: ethers.parseEther(bidForm.amount)
      });
      await tx.wait();
      
      showMessage('Ra giá thành công!', 'success');
      setBidForm({ auctionId: '', amount: '' });
      fetchActiveAuctions();
    } catch (error) {
      console.error('Lỗi ra giá:', error);
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🎨 Nền tảng đấu giá nghệ thuật số</h1>
        {!account ? (
          <button 
            onClick={connectWallet} 
            disabled={loading}
            className="connect-btn"
          >
            {loading ? 'Đang kết nối...' : 'Kết nối MetaMask'}
          </button>
        ) : (
          <div className="user-info">
            <span>Đã kết nối: {account.slice(0, 6)}...{account.slice(-4)}</span>
          </div>
        )}
      </header>

      {/* Messages */}
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {account && (
        <div className="main-content">
          {/* Navigation Tabs */}
          <nav className="tabs">
            <button 
              className={activeTab === 'gallery' ? 'active' : ''}
              onClick={() => setActiveTab('gallery')}
            >
              Thư viện nghệ thuật
            </button>
            <button 
              className={activeTab === 'create' ? 'active' : ''}
              onClick={() => setActiveTab('create')}
            >
              Tạo NFT
            </button>
            <button 
              className={activeTab === 'auctions' ? 'active' : ''}
              onClick={() => setActiveTab('auctions')}
            >
              Đấu giá đang diễn ra
            </button>
            <button 
              className={activeTab === 'bid' ? 'active' : ''}
              onClick={() => setActiveTab('bid')}
            >
              Ra giá
            </button>
          </nav>

          {/* Create NFT Section */}
          {activeTab === 'create' && (
            <section className="section">
              <h2>Tạo tác phẩm mới</h2>
              <form onSubmit={createNFT} className="form">
                <input
                  type="text"
                  placeholder="Tên tác phẩm *"
                  value={nftForm.name}
                  onChange={(e) => setNftForm({...nftForm, name: e.target.value})}
                  required
                />
                <textarea
                  placeholder="Mô tả"
                  value={nftForm.description}
                  onChange={(e) => setNftForm({...nftForm, description: e.target.value})}
                  rows="3"
                />
                <div className="file-upload">
                  <label>Ảnh tác phẩm *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNftForm({...nftForm, image: e.target.files[0]})}
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Đang tạo NFT...' : 'Tạo NFT'}
                </button>
              </form>
            </section>
          )}

          {/* Create Auction Section */}
          {activeTab === 'create' && (
            <section className="section">
              <h2>Tạo đấu giá</h2>
              <form onSubmit={createAuction} className="form">
                <input
                  type="number"
                  placeholder="Token ID *"
                  value={auctionForm.tokenId}
                  onChange={(e) => setAuctionForm({...auctionForm, tokenId: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Giá khởi điểm (ETH) *"
                  value={auctionForm.startPrice}
                  onChange={(e) => setAuctionForm({...auctionForm, startPrice: e.target.value})}
                  required
                />
                <input
                  type="number"
                  placeholder="Thời lượng (phút) *"
                  value={auctionForm.duration}
                  onChange={(e) => setAuctionForm({...auctionForm, duration: e.target.value})}
                  required
                />
                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Đang tạo đấu giá...' : 'Tạo đấu giá'}
                </button>
              </form>
            </section>
          )}

          {/* Place Bid Section */}
          {activeTab === 'bid' && (
            <section className="section">
              <h2>Ra giá</h2>
              <form onSubmit={placeBid} className="form">
                <input
                  type="number"
                  placeholder="ID đấu giá*"
                  value={bidForm.auctionId}
                  onChange={(e) => setBidForm({...bidForm, auctionId: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Số tiền đặt (ETH) *"
                  value={bidForm.amount}
                  onChange={(e) => setBidForm({...bidForm, amount: e.target.value})}
                  required
                />
                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Đang ra giá...' : 'Ra giá'}
                </button>
              </form>
            </section>
          )}

          {/* NFTs Gallery */}
          {activeTab === 'gallery' && (
            <section className="section">
              <h2>Thư viện nghệ thuật ({nfts.length} mục)</h2>
              {nfts.length === 0 ? (
                <div className="empty-state">
                  <p>Chưa có tác phẩm nghệ thuật nào. Hãy tạo NFT đầu tiên của bạn!</p>
                </div>
              ) : (
                <div className="nft-grid">
                  {nfts.map(nft => (
                    <div key={nft._id} className="nft-card">
                      <div className="nft-image">
                        <img 
                          src={nft.image} 
                          alt={nft.name}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300x300?text=Artwork';
                          }}
                        />
                      </div>
                      <div className="nft-info">
                        <h3>{nft.name}</h3>
                        <p className="description">{nft.description}</p>
                        <div className="nft-meta">
                          <small>Token ID: {nft.tokenId}</small>
                          <small>Nghệ sĩ: {nft.artist}</small>
                          <small>Ngày tạo: {new Date(nft.createdAt).toLocaleDateString()}</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Active Auctions */}
          {activeTab === 'auctions' && (
            <section className="section">
              <h2>Đấu giá đang diễn ra ({auctions.length})</h2>
              {auctions.length === 0 ? (
                <div className="empty-state">
                  <p>Chưa có đấu giá nào đang diễn ra. Hãy tạo một đấu giá từ NFT của bạn!</p>
                </div>
              ) : (
                <div className="auctions-grid">
                  {auctions.map(auction => (
                    <div key={auction._id} className="auction-card">
                      <div className="auction-header">
                        <h3>Đấu giá #{auction.auctionId}</h3>
                        <span className={`status ${formatTimeRemaining(auction.endTime) === 'Ended' ? 'ended' : 'active'}`}>
                          {formatTimeRemaining(auction.endTime)}
                        </span>
                      </div>
                      
                      {auction.nftMetadata && (
                        <div className="auction-nft">
                          <img 
                            src={auction.nftMetadata.image} 
                            alt={auction.nftMetadata.name}
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/200x200?text=Artwork';
                            }}
                          />
                          <div className="nft-details">
                            <h4>{auction.nftMetadata.name}</h4>
                            <p>{auction.nftMetadata.description}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="auction-details">
                        <div className="detail-row">
                          <span>Token ID:</span>
                          <span>{auction.tokenId}</span>
                        </div>
                        <div className="detail-row">
                          <span>Người bán:</span>
                          <span className="address">{auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}</span>
                        </div>
                        <div className="detail-row">
                          <span>Giá hiện tại:</span>
                          <span className="bid-amount">
                            {ethers.formatEther(auction.highestBid || '0')} ETH
                          </span>
                        </div>
                        <div className="detail-row">
                          <span>Số lượt ra giá:</span>
                          <span>{auction.bids?.length || 0}</span>
                        </div>
                        <div className="detail-row">
                          <span>Kết thúc:</span>
                          <span>{new Date(auction.endTime).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {auction.highestBidder && (
                        <div className="current-bidder">
                          Người ra giá cao nhất: {auction.highestBidder.slice(0, 6)}...{auction.highestBidder.slice(-4)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Đang tải...</div>
        </div>
      )}
    </div>
  );
}

export default App;