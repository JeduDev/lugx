// Admin Panel JavaScript
// Main dashboard functionality

// Verificar autenticación ANTES de cualquier otra cosa
(function checkAuthenticationFirst() {
    try {
        let sessionData = localStorage.getItem('lugx_session');
        if (!sessionData) {
            sessionData = sessionStorage.getItem('lugx_session');
        }
        
        if (!sessionData) {
            // No hay sesión, redirigir al login
            window.location.href = 'login.html';
            return;
        }
        
        const session = JSON.parse(sessionData);
        if (!session.token) {
            // No hay token, redirigir al login
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = 'login.html';
        return;
    }
})();

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    loadDashboardStats();
    setupEventListeners();
});

// Initialize dashboard components
function initializeDashboard() {
    console.log('Dashboard initialized');
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update every second
}

// Load dashboard statistics
function loadDashboardStats() {
    // Sample data - in a real application, this would come from an API
    const stats = {
        totalTrajes: 45,
        totalClientes: 28,
        rentasActivas: 12,
        ingresosMes: 15750
    };

    // Update stats cards
    updateStatsCard('totalTrajes', stats.totalTrajes);
    updateStatsCard('totalClientes', stats.totalClientes);
    updateStatsCard('rentasActivas', stats.rentasActivas);
    updateStatsCard('ingresosMes', `$${stats.ingresosMes.toLocaleString()}`);
}

// Update individual stats card
function updateStatsCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation menu items
    const menuItems = document.querySelectorAll('.nav-link');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Remove active class from all items
            menuItems.forEach(menu => menu.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
        });
    });

    // Quick action buttons
    const quickActions = document.querySelectorAll('.quick-action-btn');
    quickActions.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            handleQuickAction(action);
        });
    });
}

// Handle quick actions
function handleQuickAction(action) {
    switch(action) {
        case 'add-traje':
            window.location.href = 'trajes.html';
            break;
        case 'add-cliente':
            window.location.href = 'clientes.html';
            break;
        case 'add-renta':
            window.location.href = 'rentas.html';
            break;
        case 'view-reports':
            showNotification('Funcionalidad de reportes próximamente', 'info');
            break;
        default:
            console.log('Unknown action:', action);
    }
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        dateTimeElement.textContent = now.toLocaleDateString('es-ES', options);
    }
}

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert">
            <span>&times;</span>
        </button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('es-ES');
}

// Export functions for global access
window.showNotification = showNotification;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;