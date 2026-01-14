-- Add financial fields to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) COMMENT 'Costo total del servicio',
ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(10, 2) COMMENT 'Costo de mano de obra',
ADD COLUMN IF NOT EXISTS material_cost DECIMAL(10, 2) COMMENT 'Costo de materiales';

