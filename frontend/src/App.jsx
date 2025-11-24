import React, { useState, useEffect, useRef } from 'react';
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
  "function approve(address to, uint256 tokenId) public",
  "function balanceOf(address owner) public view returns (uint256)",
  "function currentTokenId() public view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const AUCTION_ABI = [
  "function createAuction(uint256 _tokenId, uint256 _startPrice, uint256 _durationInMinutes) external",
  "function placeBid(uint256 _auctionId) external payable",
  "function endAuction(uint256 _auctionId) external",
  "function getAuctionDetails(uint256 _auctionId) external view returns (tuple(uint256 tokenId, address seller, uint256 startTime, uint256 endTime, uint256 startPrice, address highestBidder, uint256 highestBid, bool ended))",
  "function auctions(uint256) public view returns (uint256 tokenId, address seller, uint256 startTime, uint256 endTime, uint256 startPrice, address highestBidder, uint256 highestBid, bool ended)",
  "function getCurrentAuctionId() public view returns (uint256)",
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

  // Refs để tránh re-render vô hạn và theo dõi state hiện tại
  const isInitialized = useRef(false);
  const currentAccountRef = useRef('');

  // Hàm khởi tạo contracts
  const initializeContracts = async (web3Signer) => {
    try {
      const artToken = new ethers.Contract(ART_TOKEN_ADDRESS, ART_TOKEN_ABI, web3Signer);
      const auction = new ethers.Contract(AUCTION_ADDRESS, AUCTION_ABI, web3Signer);
      
      setArtTokenContract(artToken);
      setAuctionContract(auction);
      console.log('✅ Contracts initialized for account:', await web3Signer.getAddress());
    } catch (error) {
      console.error('❌ Error initializing contracts:', error);
    }
  };

  // Hàm cập nhật provider và signer
  const updateProviderAndSigner = async () => {
    if (window.ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await web3Provider.getSigner();
        const newAccount = await newSigner.getAddress();
        
        setProvider(web3Provider);
        setSigner(newSigner);
        setAccount(newAccount);
        currentAccountRef.current = newAccount; // Cập nhật ref
        
        await initializeContracts(newSigner);
        
        console.log('🔄 Account updated to:', newAccount);
        showMessage(`Đã chuyển sang tài khoản: ${newAccount.slice(0, 6)}...${newAccount.slice(-4)}`, 'success');
        
        // Fetch lại dữ liệu
        fetchNFTs();
        fetchActiveAuctions();
      } catch (error) {
        console.error('❌ Error updating provider and signer:', error);
      }
    }
  };

  // Hàm xử lý sự kiện accountsChanged - ĐÃ SỬA
  const handleAccountsChanged = async (accounts) => {
    console.log('🔄 Accounts changed:', accounts);
    console.log('📝 Current account in ref:', currentAccountRef.current);
    
    if (accounts.length === 0) {
      // Người dùng đã disconnect
      console.log('👤 User disconnected');
      setAccount('');
      currentAccountRef.current = '';
      setProvider(null);
      setSigner(null);
      setArtTokenContract(null);
      setAuctionContract(null);
      showMessage('Đã ngắt kết nối ví', 'error');
    } else {
      // Người dùng đã chuyển tài khoản
      const newAccount = accounts[0];
      console.log('🔍 Comparing:', newAccount.toLowerCase(), 'vs', currentAccountRef.current.toLowerCase());
      
      // So sánh với ref thay vì state
      if (newAccount.toLowerCase() !== currentAccountRef.current.toLowerCase()) {
        console.log('🔄 Switching to new account:', newAccount);
        await updateProviderAndSigner();
      } else {
        console.log('✅ Same account, no change needed');
      }
    }
  };

  // Hàm xử lý sự kiện chainChanged
  const handleChainChanged = (chainId) => {
    console.log('🔄 Chain changed:', chainId);
    // Reload page khi chain thay đổi
    window.location.reload();
  };

  useEffect(() => {
    if (account && artTokenContract && auctionContract) {
      fetchNFTs();
      fetchActiveAuctions();
    }
  }, [account, artTokenContract, auctionContract]);

  useEffect(() => {
    // Chỉ thiết lập event listeners một lần
    if (isInitialized.current) return;
    
    if (window.ethereum) {
      console.log('🔧 Setting up MetaMask event listeners...');
      
      // Kiểm tra xem đã có account nào được kết nối chưa
      const checkConnectedAccount = async () => {
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts' 
          });
          if (accounts.length > 0) {
            console.log('🔍 Found connected account:', accounts[0]);
            // Tự động kết nối với account đã được kết nối trước đó
            await updateProviderAndSigner();
          }
        } catch (error) {
          console.error('❌ Error checking connected accounts:', error);
        }
      };
      
      checkConnectedAccount();
      
      // Thiết lập event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      isInitialized.current = true;

      // Cleanup function
      return () => {
        console.log('🧹 Cleaning up event listeners...');
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

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
        throw new Error('Vui lòng cài đặt MetaMask!');
      }

      // Yêu cầu kết nối ví
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (accounts.length === 0) {
        throw new Error('Không có tài khoản nào được kết nối');
      }

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const userAddress = await web3Signer.getAddress();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(userAddress);
      currentAccountRef.current = userAddress; // Cập nhật ref

      // Khởi tạo contracts
      await initializeContracts(web3Signer);

      showMessage(`Kết nối ví thành công! Tài khoản: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`, 'success');
      
    } catch (error) {
      console.error('❌ Lỗi kết nối ví:', error);
      
      let errorMessage = error.message;
      if (error.code === 4001) {
        errorMessage = 'Người dùng đã từ chối kết nối ví';
      }
      
      showMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      // Trong MetaMask, chúng ta không thể thực sự "disconnect" programmatically
      // Nhưng có thể reset state
      setAccount('');
      currentAccountRef.current = '';
      setProvider(null);
      setSigner(null);
      setArtTokenContract(null);
      setAuctionContract(null);
      setNfts([]);
      setAuctions([]);
      
      showMessage('Đã ngắt kết nối ví', 'success');
    } catch (error) {
      console.error('❌ Lỗi khi ngắt kết nối:', error);
    }
  };

  const fetchNFTs = async () => {
    try {
      console.log('📡 Fetching NFTs...');
      const response = await fetch(`${API_BASE}/nfts`);
      if (!response.ok) throw new Error('Không thể lấy danh sách NFTs');
      const data = await response.json();
      setNfts(data);
      console.log(`✅ Loaded ${data.length} NFTs`);
    } catch (error) {
      console.error('❌ Lỗi tải NFTs:', error);
      showMessage('Không thể tải danh sách NFTs');
    }
  };

  const fetchActiveAuctions = async () => {
    try {
      console.log('📡 Fetching active auctions...');
      const response = await fetch(`${API_BASE}/active-auctions`);
      if (!response.ok) throw new Error('Không thể lấy danh sách đấu giá');
      const data = await response.json();
      setAuctions(data);
      console.log(`✅ Loaded ${data.length} active auctions`);
    } catch (error) {
      console.error('❌ Lỗi tải đấu giá:', error);
      showMessage('Không thể tải danh sách đấu giá');
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

      // Upload artwork to backend
      const formData = new FormData();
      formData.append('name', nftForm.name);
      formData.append('description', nftForm.description || '');
      formData.append('artist', 'Digital Artist');
      formData.append('artistAddress', account);
      formData.append('image', nftForm.image);

      console.log('📤 Đang upload artwork...');
      
      const uploadResponse = await fetch(`${API_BASE}/upload-artwork`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload thất bại với status: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload không thành công');
      }

      console.log('✅ Upload thành công, đang mint NFT...');

      // Mint NFT on blockchain
      const tx = await artTokenContract.safeMint(account);
      console.log('⛓️ Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed');

      // Get token ID từ event
      let tokenId = '0';
      const transferInterface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
      ]);
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = transferInterface.parseLog(log);
          if (parsedLog && parsedLog.name === 'Transfer') {
            tokenId = parsedLog.args.tokenId.toString();
            break;
          }
        } catch (e) {
          // Bỏ qua log không phải Transfer event
        }
      }

      console.log('🎯 Token ID:', tokenId);

      // Save metadata to backend
      const saveResponse = await fetch(`${API_BASE}/nft-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          ...uploadData.metadata,
          imageIpfsHash: uploadData.imageIpfsHash,
          metadataIpfsHash: uploadData.metadataIpfsHash
        })
      });

      if (!saveResponse.ok) {
        throw new Error('Lưu metadata thất bại');
      }

      console.log('✅ Metadata saved');

      showMessage('Tạo NFT thành công!', 'success');
      setNftForm({ name: '', description: '', image: null });
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
      fetchNFTs();
      
    } catch (error) {
      console.error('❌ Lỗi tạo NFT:', error);
      showMessage(error.message);
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
    
    if (diff <= 0) return 'Đã kết thúc';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}giờ ${minutes}phút`;
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
            <div className="account-display">
              <span className="account-address">
                Tài khoản: {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <button 
                onClick={disconnectWallet}
                className="disconnect-btn"
                title="Ngắt kết nối"
              >
                ✕
              </button>
            </div>
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
                  placeholder="Auction ID *"
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
                        <span className={`status ${formatTimeRemaining(auction.endTime) === 'Đã kết thúc' ? 'ended' : 'active'}`}>
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
                          <span>{new Date(auction.endTime).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                      
                      {auction.highestBidder && auction.highestBidder !== '0x0000000000000000000000000000000000000000' && (
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