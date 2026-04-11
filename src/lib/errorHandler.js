/**
 * Convert technical database errors to user-friendly messages
 * @param {Error} error - The error object
 * @param {string} context - What action was being performed
 * @param {string} lang - Language (ar or en)
 * @returns {string} - User-friendly error message
 */
export const getErrorMessage = (error, context = 'Operation', lang = 'en') => {
    const isAr = lang === 'ar';
    
    const errorMessage = error?.message || '';
    
    // Map technical errors to user-friendly messages
    const errorMap = {
        'foreign key': isAr ? 'هناك بيانات مرتبطة بهذا العنصر' : 'This item has dependent data that cannot be deleted',
        'unique violation': isAr ? 'هذا البيان موجود بالفعل' : 'This record already exists',
        'syntax error': isAr ? 'خطأ في البيانات المرسلة' : 'Invalid data format',
        'permission': isAr ? 'ليس لديك صلاحية لهذا الإجراء' : 'You do not have permission for this action',
        'not found': isAr ? 'البيان المطلوب غير موجود' : 'The requested record was not found',
        'timeout': isAr ? 'انتهت انتظار الخادم. يرجى المحاولة مجددا' : 'Request timed out. Please try again',
        'connection': isAr ? 'خطأ في الاتصال بالخادم' : 'Connection error. Please check your internet',
    };
    
    // Check if error matches any known pattern
    for (const [key, message] of Object.entries(errorMap)) {
        if (errorMessage.toLowerCase().includes(key)) {
            return message;
        }
    }
    
    // Default user-friendly message
    const defaultMessages = {
        ar: `حدث خطأ أثناء ${context}. يرجى المحاولة مجددا`,
        en: `Unable to complete ${context}. Please try again later`,
    };
    
    return defaultMessages[lang] || defaultMessages.en;
};
