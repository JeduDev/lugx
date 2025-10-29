// Users Management JavaScript

// Sample users data (in a real application, this would come from a database)
let users = [
    {
        id: 1,
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan@lugx.com',
        phone: '+1234567890',
        role: 'admin',
        status: 'active',
        lastAccess: '2024-01-15 10:30',
        address: 'Calle Principal 123',
        city: 'Madrid',
        country: 'España'
    },
    {
        id: 2,
        firstName: 'María',
        lastName: 'García',
        email: 'maria@lugx.com',
        phone: '+1234567891',
        role: 'manager',
        status: 'active',
        lastAccess: '2024-01-15 09:15',
        address: 'Avenida Central 456',
        city: 'Barcelona',
        country: 'España'
    }
];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchUser').addEventListener('input', filterUsers);
    
    // Filter functionality
    document.getElementById('roleFilter').addEventListener('change', filterUsers);
    document.getElementById('statusFilter').addEventListener('change', filterUsers);
    
    // Form validation
    document.getElementById('userForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (validateUserForm()) {
            saveUser();
        }
    });
}

// Load and display users
function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
    
    updateUserStats();
}

// Create user table row
function createUserRow(user) {
    const row = document.createElement('tr');
    
    const roleColors = {
        'admin': 'bg-danger',
        'manager': 'bg-warning',
        'employee': 'bg-info',
        'customer': 'bg-primary'
    };
    
    const statusColors = {
        'active': 'bg-success',
        'inactive': 'bg-secondary',
        'suspended': 'bg-danger'
    };
    
    const roleLabels = {
        'admin': 'Administrador',
        'manager': 'Gerente',
        'employee': 'Empleado',
        'customer': 'Cliente'
    };
    
    const statusLabels = {
        'active': 'Activo',
        'inactive': 'Inactivo',
        'suspended': 'Suspendido'
    };
    
    row.innerHTML = `
        <td>${user.id}</td>
        <td>
            <div class="user-avatar">
                <i class="fa fa-user-circle"></i>
            </div>
        </td>
        <td>${user.firstName} ${user.lastName}</td>
        <td>${user.email}</td>
        <td><span class="badge ${roleColors[user.role]}">${roleLabels[user.role]}</span></td>
        <td><span class="badge ${statusColors[user.status]}">${statusLabels[user.status]}</span></td>
        <td>${user.lastAccess}</td>
        <td>
            <button class="btn-edit" onclick="editUser(${user.id})">Editar</button>
            <button class="btn-delete" onclick="deleteUser(${user.id})">Eliminar</button>
        </td>
    `;
    
    return row;
}

// Filter users based on search and filters
function filterUsers() {
    const searchTerm = document.getElementById('searchUser').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.firstName.toLowerCase().includes(searchTerm) ||
                            user.lastName.toLowerCase().includes(searchTerm) ||
                            user.email.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    displayFilteredUsers(filteredUsers);
}

// Display filtered users
function displayFilteredUsers(filteredUsers) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    filteredUsers.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
}

// Show add user modal
function showAddUserModal() {
    document.getElementById('userModalLabel').textContent = 'Agregar Nuevo Usuario';
    document.getElementById('userForm').reset();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
}

// Edit user
function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // Populate form with user data
    document.getElementById('firstName').value = user.firstName;
    document.getElementById('lastName').value = user.lastName;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userPhone').value = user.phone;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userStatus').value = user.status;
    document.getElementById('userAddress').value = user.address;
    document.getElementById('userCity').value = user.city;
    document.getElementById('userCountry').value = user.country;
    
    // Hide password fields for editing
    document.getElementById('userPassword').parentElement.style.display = 'none';
    document.getElementById('confirmUserPassword').parentElement.style.display = 'none';
    
    // Update modal title
    document.getElementById('userModalLabel').textContent = 'Editar Usuario';
    
    // Store user ID for updating
    document.getElementById('userForm').dataset.userId = userId;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    modal.show();
}

// Delete user
function deleteUser(userId) {
    if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
        users = users.filter(u => u.id !== userId);
        loadUsers();
        showNotification('Usuario eliminado exitosamente', 'success');
    }
}

// Save user (add or update)
function saveUser() {
    const form = document.getElementById('userForm');
    const userId = form.dataset.userId;
    
    const userData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('userEmail').value,
        phone: document.getElementById('userPhone').value,
        role: document.getElementById('userRole').value,
        status: document.getElementById('userStatus').value,
        address: document.getElementById('userAddress').value,
        city: document.getElementById('userCity').value,
        country: document.getElementById('userCountry').value
    };
    
    if (userId) {
        // Update existing user
        const userIndex = users.findIndex(u => u.id == userId);
        if (userIndex !== -1) {
            users[userIndex] = { ...users[userIndex], ...userData };
            showNotification('Usuario actualizado exitosamente', 'success');
        }
    } else {
        // Add new user
        const newUser = {
            id: Math.max(...users.map(u => u.id)) + 1,
            ...userData,
            lastAccess: new Date().toISOString().slice(0, 16).replace('T', ' ')
        };
        users.push(newUser);
        showNotification('Usuario agregado exitosamente', 'success');
    }
    
    // Reset form and close modal
    form.reset();
    form.removeAttribute('data-user-id');
    
    // Show password fields again
    document.getElementById('userPassword').parentElement.style.display = 'block';
    document.getElementById('confirmUserPassword').parentElement.style.display = 'block';
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
    modal.hide();
    
    loadUsers();
}

// Validate user form
function validateUserForm() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const confirmPassword = document.getElementById('confirmUserPassword').value;
    const role = document.getElementById('userRole').value;
    
    if (!firstName || !lastName || !email || !role) {
        showNotification('Por favor, completa todos los campos requeridos', 'error');
        return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Por favor, ingresa un email válido', 'error');
        return false;
    }
    
    // Password validation (only for new users)
    const isEditing = document.getElementById('userForm').dataset.userId;
    if (!isEditing) {
        if (!password || password.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return false;
        }
        
        if (password !== confirmPassword) {
            showNotification('Las contraseñas no coinciden', 'error');
            return false;
        }
    }
    
    // Check for duplicate email
    const existingUser = users.find(u => u.email === email && u.id != isEditing);
    if (existingUser) {
        showNotification('Ya existe un usuario con este email', 'error');
        return false;
    }
    
    return true;
}

// Update user statistics
function updateUserStats() {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const admins = users.filter(u => u.role === 'admin').length;
    
    // Calculate new users this month (simplified)
    const newUsersThisMonth = Math.floor(totalUsers * 0.1);
    
    // Update stats cards
    document.querySelector('.admin-card:nth-child(1) h4').textContent = totalUsers;
    document.querySelector('.admin-card:nth-child(2) h4').textContent = activeUsers;
    document.querySelector('.admin-card:nth-child(3) h4').textContent = newUsersThisMonth;
    document.querySelector('.admin-card:nth-child(4) h4').textContent = admins;
}

// Export users
function exportUsers() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "ID,Nombre,Apellido,Email,Teléfono,Rol,Estado,Último Acceso,Dirección,Ciudad,País\n"
        + users.map(user => 
            `${user.id},"${user.firstName}","${user.lastName}","${user.email}","${user.phone}","${user.role}","${user.status}","${user.lastAccess}","${user.address}","${user.city}","${user.country}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "usuarios.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Usuarios exportados exitosamente', 'success');
}

// Show notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}