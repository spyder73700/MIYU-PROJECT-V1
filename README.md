# Mio Pharma Trekker

A comprehensive **Pharmacy Management System** built with React and Node.js.

## Features

- **Authentication**: Username/password login with Google OAuth integration
- **Dashboard**: Overview of sales, purchases, and profit metrics
- **Purchase Management**: Track medicine purchases from suppliers
- **Sales Management**: Record and manage medicine sales to customers
- **Inventory**: Placeholder for future stock management (coming soon)
- **Financial Reports**: Placeholder for detailed financial analytics (coming soon)
- **Supplier Management**: Placeholder for supplier database (coming soon)
- **Backup**: Placeholder for data backup functionality (coming soon)

## Tech Stack

### Frontend
- React (JavaScript)
- React Router DOM
- Axios for API calls
- CSS-in-JS styling

### Backend
- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- Passport.js for Google OAuth
- bcryptjs for password hashing

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- Google OAuth credentials (for Google login)

## Project Structure

```
Miyu Project/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── contexts/   # React contexts (AuthContext)
│   │   ├── layouts/    # Layout components (MainLayout)
│   │   ├── pages/      # Page components
│   │   └── utils/      # Utility functions (API)
│   └── package.json
├── backend/            # Node.js backend
│   ├── models/         # MongoDB models
│   ├── routes/         # API routes
│   ├── middleware/     # Authentication middleware
│   ├── server.js       # Main server file
│   └── package.json
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Environment Configuration

#### Backend (.env file)
Create a `.env` file in the `backend` folder with:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mio-pharma-trekker
JWT_SECRET=your-jwt-secret-key-change-this-in-production
SESSION_SECRET=your-session-secret-key-change-this-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
```

To get Google OAuth credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`

### 3. Start MongoDB

Make sure MongoDB is running locally:
```bash
# Windows
mongod

# Or use MongoDB Atlas (cloud) - update MONGODB_URI accordingly
```

### 4. Run the Application

#### Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```
Backend will run on http://localhost:5000

#### Start Frontend (Terminal 2)
```bash
cd frontend
npm start
```
Frontend will run on http://localhost:3000

### 5. Access the Application

Open your browser and navigate to: **http://localhost:3000**

## Default Login

You can register a new account or use Google OAuth to sign in.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user

### Purchases
- `GET /api/purchases` - Get all purchases
- `POST /api/purchases` - Create new purchase
- `PUT /api/purchases/:id` - Update purchase
- `DELETE /api/purchases/:id` - Delete purchase

### Sales
- `GET /api/sales` - Get all sales
- `POST /api/sales` - Create new sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

## Development Roadmap

### Phase 1 (Current) ✅
- Basic authentication
- Dashboard with metrics
- Purchase management
- Sales management

### Phase 2 (Upcoming)
- Inventory management with stock tracking
- Financial reports and analytics
- Supplier management
- Data backup and restore

## License

This project is built for educational and commercial use.

## Support

For any issues or feature requests, please contact the development team.

---

**Built with ❤️ for Mio Pharma Trekker**
