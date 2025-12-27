/**
 * Password strength checker
 * Evaluates password strength based on multiple criteria
 */

/**
 * Calculate password strength score
 * @param {string} password - Password to evaluate
 * @returns {Object} - { score: number (0-100), strength: string, feedback: Array<string> }
 */
export function checkPasswordStrength(password) {
	if (!password) {
		return {
			score: 0,
			strength: 'empty',
			feedback: []
		};
	}

	const feedback = [];
	let score = 0;

	// Length checks
	if (password.length < 8) {
		feedback.push('Password should be at least 8 characters long');
	} else if (password.length < 12) {
		score += 10;
		feedback.push('Consider using 12+ characters for better security');
	} else if (password.length < 16) {
		score += 20;
	} else {
		score += 30;
	}

	// Character variety checks
	const hasLowerCase = /[a-z]/.test(password);
	const hasUpperCase = /[A-Z]/.test(password);
	const hasNumbers = /\d/.test(password);
	const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

	if (hasLowerCase) score += 10;
	else feedback.push('Add lowercase letters');

	if (hasUpperCase) score += 10;
	else feedback.push('Add uppercase letters');

	if (hasNumbers) score += 10;
	else feedback.push('Add numbers');

	if (hasSpecialChar) score += 15;
	else feedback.push('Add special characters (!@#$%^&*...)');

	// Pattern checks (penalize common patterns)
	const commonPatterns = [
		/12345/,
		/abcde/,
		/qwerty/,
		/password/i,
		/letmein/i,
		/welcome/i
	];

	const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
	if (hasCommonPattern) {
		score -= 20;
		feedback.push('Avoid common patterns or dictionary words');
	}

	// Repetition check
	const hasRepetition = /(.)\1{2,}/.test(password);
	if (hasRepetition) {
		score -= 10;
		feedback.push('Avoid repeating characters');
	}

	// Sequential characters check
	const hasSequential = /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password);
	if (hasSequential) {
		score -= 10;
		feedback.push('Avoid sequential characters');
	}

	// Bonus for length and variety
	if (password.length >= 16 && hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChar) {
		score += 15;
	}

	// Clamp score between 0 and 100
	score = Math.max(0, Math.min(100, score));

	// Determine strength level
	let strength;
	if (score < 30) {
		strength = 'weak';
	} else if (score < 60) {
		strength = 'fair';
	} else if (score < 80) {
		strength = 'good';
	} else {
		strength = 'strong';
	}

	// If score is high, provide positive feedback
	if (score >= 80 && feedback.length === 0) {
		feedback.push('Excellent password strength!');
	} else if (score >= 60 && feedback.length === 0) {
		feedback.push('Good password strength');
	}

	return {
		score,
		strength,
		feedback: feedback.slice(0, 3) // Limit to 3 feedback items
	};
}

/**
 * Get color for password strength indicator
 * @param {string} strength - Strength level
 * @returns {string} - CSS color
 */
export function getStrengthColor(strength) {
	switch (strength) {
		case 'weak':
			return '#ff6b6b'; // Red
		case 'fair':
			return '#ffa500'; // Orange
		case 'good':
			return '#4a9eff'; // Blue
		case 'strong':
			return '#16a34a'; // Green
		default:
			return '#999'; // Gray
	}
}

/**
 * Get strength label
 * @param {string} strength - Strength level
 * @returns {string} - Human-readable label
 */
export function getStrengthLabel(strength) {
	switch (strength) {
		case 'weak':
			return 'Weak';
		case 'fair':
			return 'Fair';
		case 'good':
			return 'Good';
		case 'strong':
			return 'Strong';
		default:
			return 'Empty';
	}
}

/**
 * Validate password meets minimum requirements
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @param {number} options.minScore - Minimum score required (0-100, default: 40)
 * @param {number} options.minLength - Minimum length (default: 8)
 * @returns {Object} - { valid: boolean, error?: string, strength: Object }
 */
export function validatePasswordStrength(password, options = {}) {
	const { minScore = 40, minLength = 8 } = options;

	if (!password || password.length < minLength) {
		return {
			valid: false,
			error: `Password must be at least ${minLength} characters long`,
			strength: checkPasswordStrength(password)
		};
	}

	const strength = checkPasswordStrength(password);

	if (strength.score < minScore) {
		return {
			valid: false,
			error: 'Password is too weak. Please use a stronger password with uppercase, lowercase, numbers, and special characters.',
			strength
		};
	}

	return {
		valid: true,
		strength
	};
}

