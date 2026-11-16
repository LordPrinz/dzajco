-- The v2 visit import is finished; 0003 stays because applied migrations are tracked by name.
DROP TRIGGER IF EXISTS v2_visit_import_apply;
DROP TABLE IF EXISTS v2_visit_import;
